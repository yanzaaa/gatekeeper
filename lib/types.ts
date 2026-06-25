export type Action = "approve" | "deny" | "escalate";

export interface RefundRequest {
  id: string;
  customer: string;
  orderId: string;
  amount: number;
  currency: string;
  category: string;
  reason: string;            // the customer's stated reason
  daysSincePurchase: number;
  itemCondition: string;     // "unopened" | "opened, defective" | "used" | "damaged on arrival" | ...
  customerHistory: string;   // e.g. "first purchase" | "4 refunds in last 30 days"
}

export interface Decision {
  requestId: string;
  action: Action;            // the FINAL action after the restraint guardrail
  confidence: number;        // 0..1 (model's self-reported confidence)
  reasoning: string;         // short human-readable rationale
  riskFlags: string[];       // e.g. ["high-value", "serial-refunder", "policy-ambiguous"]
  policyBasis: string;       // which policy rule drove the call
  rawAction: Action;         // what the model proposed BEFORE the guardrail
  heldBack: boolean;         // true if the restraint guardrail overrode an auto-action to escalate
  engine: "qwen" | "fallback";
  model?: string;
  toolsUsed?: string[];      // Qwen tools the agent invoked during reasoning (e.g. assess_customer_risk)
}

// Deterministic signals the agent looks up via a tool call instead of guessing from free text.
export interface CustomerRisk {
  priorRefunds: number;
  serialRefunder: boolean;            // 3+ prior refunds in the recent window
  reasonConflictsCondition: boolean;  // stated reason contradicts the item's actual condition
}
