import { describe, it, expect } from "vitest";
import { applyRestraint, assessCustomerRisk, fallbackTriage } from "../lib/agent";
import { RESTRAINT } from "../lib/policy";
import { QUEUE } from "../lib/data";
import type { RefundRequest } from "../lib/types";

// A clean, low-risk base request the guardrail should let pass.
const base: RefundRequest = {
  id: "T-1",
  customer: "Test",
  orderId: "o-1",
  amount: 30,
  currency: "USD",
  category: "Home",
  reason: "Arrived broken.",
  daysSincePurchase: 5,
  itemCondition: "damaged on arrival",
  customerHistory: "first purchase",
};

describe("applyRestraint — the deterministic guardrail", () => {
  it("lets a clean, confident, low-value approve pass through", () => {
    const r = applyRestraint("approve", 0.95, [], base);
    expect(r.action).toBe("approve");
    expect(r.heldBack).toBe(false);
  });

  it("lets a clean, confident deny pass through", () => {
    const r = applyRestraint("deny", 0.9, [], base);
    expect(r.action).toBe("deny");
    expect(r.heldBack).toBe(false);
  });

  it("forces escalate + heldBack on a high-value amount even at max confidence", () => {
    const r = applyRestraint("approve", 1, [], { ...base, amount: RESTRAINT.highValueAmount + 1 });
    expect(r.action).toBe("escalate");
    expect(r.heldBack).toBe(true);
  });

  it("adds the high-value flag when amount exceeds the threshold", () => {
    const r = applyRestraint("approve", 1, [], { ...base, amount: RESTRAINT.highValueAmount + 1 });
    expect(r.flags).toContain("high-value");
  });

  it("does NOT treat an amount exactly at the threshold as high-value", () => {
    const r = applyRestraint("approve", 0.95, [], { ...base, amount: RESTRAINT.highValueAmount });
    expect(r.action).toBe("approve");
    expect(r.heldBack).toBe(false);
  });

  it("forces escalate + heldBack when confidence is below the floor", () => {
    const r = applyRestraint("approve", RESTRAINT.minConfidence - 0.01, [], base);
    expect(r.action).toBe("escalate");
    expect(r.heldBack).toBe(true);
  });

  it("lets confidence exactly at the floor pass (gate is strictly-less-than)", () => {
    const r = applyRestraint("approve", RESTRAINT.minConfidence, [], base);
    expect(r.action).toBe("approve");
    expect(r.heldBack).toBe(false);
  });

  it.each(RESTRAINT.blockingFlags)("forces escalate + heldBack on blocking flag %s", (flag) => {
    const r = applyRestraint("approve", 0.99, [flag], base);
    expect(r.action).toBe("escalate");
    expect(r.heldBack).toBe(true);
  });

  it("passes a non-blocking flag through (e.g. out-of-window alone does not block)", () => {
    const r = applyRestraint("deny", 0.9, ["out-of-window"], base);
    expect(r.action).toBe("deny");
    expect(r.heldBack).toBe(false);
  });

  it("never downgrades an escalate to approve/deny (one-way ratchet)", () => {
    const r = applyRestraint("escalate", 0.99, [], base);
    expect(r.action).toBe("escalate");
    expect(r.heldBack).toBe(false); // escalate isn't an override, it's the model's own call
  });

  it("can only ever make a decision safer — never approves a case the model wanted to escalate", () => {
    for (const conf of [0, 0.5, 0.77, 0.78, 1]) {
      for (const amt of [10, RESTRAINT.highValueAmount, RESTRAINT.highValueAmount + 1000]) {
        const r = applyRestraint("escalate", conf, [], { ...base, amount: amt });
        expect(r.action).toBe("escalate");
      }
    }
  });
});

describe("assessCustomerRisk — deterministic signal lookup", () => {
  it("parses prior refund count and flags a serial refunder (>= 3)", () => {
    const risk = assessCustomerRisk("4 refunds in the last 30 days", "x", "used");
    expect(risk.priorRefunds).toBe(4);
    expect(risk.serialRefunder).toBe(true);
  });

  it("treats a first-time buyer as zero prior refunds, not serial", () => {
    const risk = assessCustomerRisk("first purchase", "x", "unopened");
    expect(risk.priorRefunds).toBe(0);
    expect(risk.serialRefunder).toBe(false);
  });

  it("does not misread 'no prior refunds' as a refund count", () => {
    const risk = assessCustomerRisk("2 purchases, no prior refunds", "x", "unopened");
    expect(risk.priorRefunds).toBe(0);
    expect(risk.serialRefunder).toBe(false);
  });

  it("flags a reason that conflicts with a used item's condition", () => {
    const risk = assessCustomerRisk("first purchase", "Item not as described.", "opened, half used");
    expect(risk.reasonConflictsCondition).toBe(true);
  });

  it("does not flag a conflict when the item is genuinely defective", () => {
    const risk = assessCustomerRisk("first purchase", "Item not as described.", "damaged on arrival");
    expect(risk.reasonConflictsCondition).toBe(false);
  });
});

describe("fallbackTriage — end-to-end on the demo queue", () => {
  const byId = (id: string) => QUEUE.find((q) => q.id === id)!;

  it("escalates the $1,240 TV (high-value) and records the held-back override", () => {
    const d = fallbackTriage(byId("RF-1007"));
    expect(d.action).toBe("escalate");
    expect(d.heldBack).toBe(true);
    expect(d.rawAction).toBe("approve"); // model path would approve a damaged-on-arrival item
    expect(d.riskFlags).toContain("high-value");
  });

  it("auto-approves a low-value damaged-on-arrival item from a first-time buyer", () => {
    const d = fallbackTriage(byId("RF-1001"));
    expect(d.action).toBe("approve");
    expect(d.heldBack).toBe(false);
  });

  it("escalates a serial refunder with conflicting evidence", () => {
    const d = fallbackTriage(byId("RF-1004"));
    expect(d.action).toBe("escalate");
    expect(d.riskFlags).toContain("serial-refunder");
  });

  it("auto-denies a used, out-of-window 'changed my mind' return", () => {
    const d = fallbackTriage(byId("RF-1002"));
    expect(d.action).toBe("deny");
    expect(d.heldBack).toBe(false);
  });

  it("auto-approves an unopened in-window item", () => {
    const d = fallbackTriage(byId("RF-1008"));
    expect(d.action).toBe("approve");
  });

  it("records that the risk-assessment tool was consulted on every decision", () => {
    for (const r of QUEUE) {
      expect(fallbackTriage(r).toolsUsed).toContain("assess_customer_risk");
    }
  });
});
