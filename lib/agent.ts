import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { Action, CustomerRisk, Decision, RefundRequest } from "./types";
import { REFUND_POLICY, RESTRAINT } from "./policy";
import { qwenClient, QWEN_MODEL } from "./qwen";

const SYSTEM = `You are Gatekeeper, an autonomous refund-triage agent for a retailer.
For each refund request you decide ONE action: "approve", "deny", or "escalate".

${REFUND_POLICY}

THE MOST IMPORTANT RULE, know when NOT to act:
You only auto-approve or auto-deny cases that are clear and low-risk. The moment a case is
risky or uncertain you must ESCALATE it to a human instead of guessing. Escalate when any of
these are true: the amount is large, the customer looks like a serial refunder or possible fraud,
the stated reason conflicts with the item condition, the policy is genuinely ambiguous, or you are
simply not confident. Over-approving a bad refund and over-denying a legitimate one are both failures;
escalation is the safe move when in doubt.

TOOL USE: before you decide, you MUST call the assess_customer_risk tool to get deterministic risk
signals (prior refunds, serial-refunder status, whether the stated reason conflicts with the item
condition). Do not guess these from the text yourself; rely on the tool's structured result.

Respond with STRICT JSON only, no prose, in exactly this shape:
{
  "action": "approve" | "deny" | "escalate",
  "confidence": number between 0 and 1,
  "reasoning": "one or two sentences, plain English",
  "riskFlags": ["zero or more of: high-value, serial-refunder, suspected-fraud, policy-ambiguous, conflicting-evidence, chargeback-risk, out-of-window, digital-redeemed"],
  "policyBasis": "the policy rule number/name that drove the call"
}`;

// The tool the agent calls to get deterministic risk signals instead of guessing from free text.
const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "assess_customer_risk",
      description:
        "Compute deterministic risk signals for a refund request: how many prior refunds the customer has, whether they are a serial refunder, and whether their stated reason conflicts with the item's actual condition. Call this before deciding.",
      parameters: {
        type: "object",
        properties: {
          customerHistory: { type: "string", description: "the customer history string, e.g. '4 refunds in the last 30 days'" },
          statedReason: { type: "string", description: "the customer's stated reason for the refund" },
          itemCondition: { type: "string", description: "the actual condition of the item" },
        },
        required: ["customerHistory", "statedReason", "itemCondition"],
      },
    },
  },
];

function userPrompt(r: RefundRequest): string {
  return `Refund request:
- id: ${r.id}
- amount: ${r.amount} ${r.currency}
- category: ${r.category}
- days since purchase: ${r.daysSincePurchase}
- item condition: ${r.itemCondition}
- customer stated reason: "${r.reason}"
- customer history: ${r.customerHistory}

Decide the action and return the JSON.`;
}

// Deterministic risk lookup. Used both as the agent's tool implementation and inside the
// key-free fallback, so the "serial refunder / conflicting reason" signals are computed the
// same robust way in both paths (no brittle regex guessing).
export function assessCustomerRisk(
  customerHistory: string,
  statedReason: string,
  itemCondition: string,
): CustomerRisk {
  const refundMatch = customerHistory.match(/(\d+)\s*refunds?/i);
  const priorRefunds = refundMatch ? parseInt(refundMatch[1], 10) : 0;
  const serialRefunder = priorRefunds >= 3;

  const cond = itemCondition.toLowerCase();
  const reason = statedReason.toLowerCase();
  const used = cond.includes("used") || cond.includes("opened") || cond.includes("worn");
  const claimsUnusedOrWrong =
    reason.includes("not as described") ||
    reason.includes("never used") ||
    reason.includes("never opened") ||
    reason.includes("wrong item");
  const reasonConflictsCondition = claimsUnusedOrWrong && used && !cond.includes("defective") && !cond.includes("damaged");

  return { priorRefunds, serialRefunder, reasonConflictsCondition };
}

// The deterministic restraint guardrail. It sits on TOP of the model: even if the model
// confidently returns approve/deny, this forces an escalation for risky or low-confidence cases.
// It is a one-way ratchet: it can only make a decision SAFER (-> escalate), never less safe.
export function applyRestraint(
  rawAction: Action,
  confidence: number,
  riskFlags: string[],
  r: RefundRequest,
): { action: Action; heldBack: boolean; flags: string[] } {
  const flags = new Set(riskFlags);
  if (r.amount > RESTRAINT.highValueAmount) flags.add("high-value");

  if (rawAction === "escalate") return { action: "escalate", heldBack: false, flags: [...flags] };

  const lowConfidence = confidence < RESTRAINT.minConfidence;
  const highValue = r.amount > RESTRAINT.highValueAmount;
  const blocking = [...flags].some((f) => (RESTRAINT.blockingFlags as readonly string[]).includes(f));

  if (lowConfidence || highValue || blocking) {
    return { action: "escalate", heldBack: true, flags: [...flags] };
  }
  return { action: rawAction, heldBack: false, flags: [...flags] };
}

// Deterministic, key-free triage so the app runs before the Qwen credits land (and as a fallback
// if the API is unavailable). Mirrors the policy + restraint rules and the same risk signals.
export function fallbackTriage(r: RefundRequest): Decision {
  const cond = r.itemCondition.toLowerCase();
  const defective = cond.includes("defective") || cond.includes("damaged");
  const risk = assessCustomerRisk(r.customerHistory, r.reason, r.itemCondition);
  const digitalRedeemed = cond.includes("digital") && (cond.includes("download") || cond.includes("access"));
  const outOfWindow = r.daysSincePurchase > 30 && !defective;

  let raw: Action = "deny";
  let confidence = 0.85;
  const flags: string[] = [];
  let basis = "Rule 4 (used/non-defective)";

  if (risk.serialRefunder) {
    flags.push("serial-refunder");
    confidence = 0.55;
  }
  if (digitalRedeemed) {
    raw = "deny";
    basis = "Rule 5 (digital redeemed)";
  } else if (defective) {
    raw = "approve";
    basis = "Rule 2 (defective/damaged)";
    confidence = 0.9;
  } else if (outOfWindow) {
    raw = "deny";
    basis = "Rule 1 (out of window)";
    flags.push("out-of-window");
  } else if (cond.includes("unopened")) {
    raw = "approve";
    basis = "Rule 3 (unopened, in window)";
    confidence = 0.88;
  } else {
    raw = "deny";
    confidence = 0.7;
  }

  let reason = `${basis} applies given a ${r.itemCondition} item at ${r.daysSincePurchase} days.`;
  if (risk.reasonConflictsCondition) {
    flags.push("conflicting-evidence");
    reason = "Stated reason conflicts with the item's actual condition.";
  }

  const restrained = applyRestraint(raw, confidence, flags, r);
  return {
    requestId: r.id,
    action: restrained.action,
    confidence,
    reasoning: reason,
    riskFlags: restrained.flags,
    policyBasis: basis,
    rawAction: raw,
    heldBack: restrained.heldBack,
    engine: "fallback",
    toolsUsed: ["assess_customer_risk"],
  };
}

export async function triage(r: RefundRequest): Promise<Decision> {
  const client = qwenClient();
  if (!client) return fallbackTriage(r);

  try {
    const convo: ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt(r) },
    ];
    const toolsUsed: string[] = [];

    // Round 1: require the agent to call the risk-assessment tool before it can decide,
    // so risk signals come from a deterministic lookup rather than the model's guess.
    const first = await client.chat.completions.create({
      model: QWEN_MODEL,
      temperature: 0,
      tools: TOOLS,
      tool_choice: { type: "function", function: { name: "assess_customer_risk" } },
      messages: convo,
    });
    const m1 = first.choices[0]?.message;

    if (m1?.tool_calls?.length) {
      convo.push({ role: "assistant", content: m1.content ?? "", tool_calls: m1.tool_calls });
      for (const tc of m1.tool_calls) {
        if (tc.type === "function" && tc.function.name === "assess_customer_risk") {
          const result = assessCustomerRisk(r.customerHistory, r.reason, r.itemCondition);
          toolsUsed.push("assess_customer_risk");
          convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        } else {
          convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "unknown tool" }) });
        }
      }
    } else if (m1?.content) {
      convo.push({ role: "assistant", content: m1.content });
    }

    // Final: force the decision JSON (no tools), with the tool results now in context.
    const completion = await client.chat.completions.create({
      model: QWEN_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [...convo, { role: "user", content: "Now return ONLY the decision JSON, nothing else." }],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      action: Action;
      confidence: number;
      reasoning: string;
      riskFlags?: string[];
      policyBasis?: string;
    };

    const rawAction: Action = ["approve", "deny", "escalate"].includes(parsed.action)
      ? parsed.action
      : "escalate";
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    const flags = Array.isArray(parsed.riskFlags) ? parsed.riskFlags : [];

    const restrained = applyRestraint(rawAction, confidence, flags, r);
    return {
      requestId: r.id,
      action: restrained.action,
      confidence,
      reasoning: parsed.reasoning || "(no reasoning returned)",
      riskFlags: restrained.flags,
      policyBasis: parsed.policyBasis || "general policy",
      rawAction,
      heldBack: restrained.heldBack,
      engine: "qwen",
      model: QWEN_MODEL,
      toolsUsed,
    };
  } catch {
    // Network/credits/parse failure: fall back so the demo never crashes.
    const fb = fallbackTriage(r);
    return { ...fb, reasoning: fb.reasoning + " (Qwen unavailable, deterministic fallback used.)" };
  }
}
