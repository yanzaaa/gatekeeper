// The refund policy Gatekeeper reasons against, plus the deterministic restraint thresholds.

export const REFUND_POLICY = `
ACME refund policy (the rules you must apply):
1. WINDOW: refunds are allowed within 30 days of purchase. Past 30 days -> deny, unless the item is defective.
2. DEFECTIVE / DAMAGED-ON-ARRIVAL items: approve a refund regardless of condition, within a reasonable window.
3. UNOPENED items within the window: approve.
4. USED / OPENED non-defective items ("changed my mind", "didn't like it"): deny.
5. DIGITAL goods that were redeemed/downloaded: deny (non-returnable), unless faulty.
6. The customer's stated reason and the item condition can conflict; weigh the evidence.
`.trim();

// The restraint guardrail. Gatekeeper must NOT auto-approve or auto-deny when any of these hold;
// it escalates to a human instead. This is the deterministic safety net layered on top of the model,
// so a confidently-wrong model can never auto-action a risky case.
export const RESTRAINT = {
  // Below this self-reported confidence, do not auto-action. Escalate.
  minConfidence: 0.78,
  // Money above this ($) needs a human sign-off regardless of how clear the case looks.
  highValueAmount: 500,
  // Risk flags that always force a human review.
  blockingFlags: ["serial-refunder", "suspected-fraud", "policy-ambiguous", "conflicting-evidence", "chargeback-risk"],
} as const;
