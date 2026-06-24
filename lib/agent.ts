import type { Action, Decision, RefundRequest } from "./types";
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

Respond with STRICT JSON only, no prose, in exactly this shape:
{
  "action": "approve" | "deny" | "escalate",
  "confidence": number between 0 and 1,
  "reasoning": "one or two sentences, plain English",
  "riskFlags": ["zero or more of: high-value, serial-refunder, suspected-fraud, policy-ambiguous, conflicting-evidence, chargeback-risk, out-of-window, digital-redeemed"],
  "policyBasis": "the policy rule number/name that drove the call"
}`;

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

// The deterministic restraint guardrail. It sits on TOP of the model: even if the model
// confidently returns approve/deny, this forces an escalation for risky or low-confidence cases.
function applyRestraint(
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
  const blocking = [...flags].some((f) => RESTRAINT.blockingFlags.includes(f));

  if (lowConfidence || highValue || blocking) {
    return { action: "escalate", heldBack: true, flags: [...flags] };
  }
  return { action: rawAction, heldBack: false, flags: [...flags] };
}

// Deterministic, key-free triage so the app runs before the Qwen credits land (and as a fallback
// if the API is unavailable). Mirrors the policy + restraint rules.
function fallbackTriage(r: RefundRequest): Decision {
  const cond = r.itemCondition.toLowerCase();
  const defective = cond.includes("defective") || cond.includes("damaged");
  const serial = /\b([3-9]|\d\d+)\b/.test(r.customerHistory) && /refund/i.test(r.customerHistory);
  const digitalRedeemed = cond.includes("digital") && (cond.includes("download") || cond.includes("access"));
  const outOfWindow = r.daysSincePurchase > 30 && !defective;

  let raw: Action = "deny";
  let confidence = 0.85;
  const flags: string[] = [];
  let basis = "Rule 4 (used/non-defective)";

  if (serial) {
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

  const reason =
    r.reason.toLowerCase().includes("not as described") && cond.includes("used")
      ? "Stated reason conflicts with the used condition."
      : `${basis} applies given a ${r.itemCondition} item at ${r.daysSincePurchase} days.`;
  if (r.reason.toLowerCase().includes("not as described") && cond.includes("used")) flags.push("conflicting-evidence");

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
  };
}

export async function triage(r: RefundRequest): Promise<Decision> {
  const client = qwenClient();
  if (!client) return fallbackTriage(r);

  try {
    const completion = await client.chat.completions.create({
      model: QWEN_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt(r) },
      ],
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
    };
  } catch {
    // Network/credits/parse failure: fall back so the demo never crashes.
    const fb = fallbackTriage(r);
    return { ...fb, reasoning: fb.reasoning + " (Qwen unavailable, deterministic fallback used.)" };
  }
}
