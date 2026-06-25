// Aggregate evidence: run the deterministic triage over the whole demo queue and write a
// committed summary, so the guardrail's value is shown across the queue (not just the one TV
// anecdote). No API key needed — uses the deterministic path so the artifact is reproducible.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { QUEUE } from "../lib/data";
import { fallbackTriage } from "../lib/agent";
import { RESTRAINT } from "../lib/policy";

const decisions = QUEUE.map(fallbackTriage);
const summary = {
  note: "Deterministic aggregate over the demo queue (no API key needed; the live Qwen path follows the same guardrail). Shows how much routine work is safely auto-resolved and how often the restraint guardrail fires.",
  thresholds: { highValueAmount: RESTRAINT.highValueAmount, minConfidence: RESTRAINT.minConfidence, blockingFlags: RESTRAINT.blockingFlags },
  cases: QUEUE.length,
  auto_approved: decisions.filter((d) => d.action === "approve").length,
  auto_denied: decisions.filter((d) => d.action === "deny").length,
  escalated: decisions.filter((d) => d.action === "escalate").length,
  held_back_by_guardrail: decisions.filter((d) => d.heldBack).length,
  rows: decisions.map((d) => ({
    id: d.requestId,
    rawAction: d.rawAction,
    finalAction: d.action,
    heldBack: d.heldBack,
    confidence: d.confidence,
    riskFlags: d.riskFlags,
  })),
};

const out = fileURLToPath(new URL("../public/benchmark.json", import.meta.url));
writeFileSync(out, JSON.stringify(summary, null, 2) + "\n");

const auto = summary.auto_approved + summary.auto_denied;
console.log(`Queue: ${summary.cases} cases`);
console.log(`  auto-resolved: ${auto} (${summary.auto_approved} approved, ${summary.auto_denied} denied)`);
console.log(`  escalated to human: ${summary.escalated}`);
console.log(`  of which the guardrail held back a model auto-action: ${summary.held_back_by_guardrail}`);
console.log(`Wrote ${out}`);
