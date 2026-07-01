# Devpost submission text: Gatekeeper

**Name:** Gatekeeper
**Tagline:** The refund autopilot that knows when to stop. An autonomous triage agent on Qwen that clears the routine cases and refuses to act on the risky ones.
**Track:** Autopilot Agent
**Built with:** Qwen, Qwen Cloud, DashScope, Next.js, TypeScript, React, Tailwind, Vercel, OpenAI-compatible API, Claude Code

---

## Inspiration

Refund and dispute triage is exactly the kind of high-volume, judgment-heavy work teams want to automate. The trap is that an agent which just auto-approves and auto-denies everything will, sooner or later, confidently refund a fraudster or reject a legitimate customer. The dangerous failure is not a slow agent, it is an autopilot that acts when it should have stopped. I wanted to build an autopilot you can actually trust, one that knows the difference between a clear case it can handle and a risky one it should hand to a human.

## What it does

You give Gatekeeper a queue of refund requests, each with the amount, item condition, stated reason, days since purchase, and customer history. For each one:

- Clear and safe cases (defective item in the window, unopened return, obvious policy match) are auto-approved or auto-denied on the spot.
- Risky or uncertain cases (high value, possible serial refunder, a stated reason that conflicts with the item, ambiguous policy, low confidence) are refused and escalated to a human, with the reasoning and the risk flags attached.

A person only ever looks at the escalation queue. Everything else is resolved automatically.

## How this differs from Quorum (my other submission)

Gatekeeper and Quorum are two of my submissions to this hackathon, and they deliberately share one idea: a **safety primitive** — a deterministic, one-way ratchet layered on top of the model that can only ever make an agent's decision *safer*, never less safe. What makes them two substantially different projects is that they validate that primitive across two completely different agent architectures.

- **Gatekeeper (Track 4, Autopilot Agent — this entry)** is a **single tool-calling agent** doing real-time refund triage. One Qwen agent, one enforced `assess_customer_risk` function call, one deterministic guardrail, a decision in a single pass. The primitive shows up as the restraint guardrail that forces an escalation on any risky case.
- **Quorum (Track 3, Agent Society)** is a **three-agent deliberative council** (Proposer, Skeptic, Referee) that reaches a decision through multi-agent debate, measures itself against a lone-agent baseline, and is itself callable by other agents over MCP. The same "can only get safer" ratchet governs how the council's verdict is allowed to move.

Different problem, different architecture, different Qwen surface — a forced tool call here, multi-agent MCP orchestration there. One idea, two independent proofs that it generalizes. If you have looked at Quorum: this is not that project with a new coat of paint. It is the other half of the argument.

## How we built it

- Qwen on Qwen Cloud is the reasoning engine, called through the OpenAI-compatible endpoint with structured JSON output.
- A deterministic restraint guardrail sits on top of the model. Even when Qwen confidently returns approve or deny, the guardrail forces an escalation when the amount is high, the confidence is low, or a blocking risk flag is present. Restraint is enforced in code, not just requested in a prompt.
- Next.js (App Router), TypeScript, and Tailwind for the dashboard and the triage API route.
- A key-free deterministic fallback keeps the app running if the API is ever unavailable, so the demo never crashes.

It is a coded agent, and I built the whole thing solo with Claude Code.

## Challenges we ran into

- The hard part of an autopilot is not the automating, it is the restraint. Getting a model to reliably stop on the right cases is not something you can leave to the prompt alone, so I moved the guarantee into deterministic code on top of the model.
- Designing a queue that actually exercises the edges (a high-value item the model wants to approve, a serial refunder, a reason that conflicts with the item) so the escalation behavior is visible and testable.
- Wiring Qwen through the OpenAI-compatible interface and getting clean structured JSON back for every case.

## Accomplishments that we're proud of

- The guardrail demonstrably catches a confidently-wrong auto-action: on a 1,240 dollar TV, Qwen returned approve with high confidence (95 percent in the recorded demo run; the committed deterministic benchmark, `public/benchmark.json`, pins the same hold-back at 0.90 — the exact figure varies run to run, the hold-back never does), and Gatekeeper escalated it instead. That moment is visible right in the UI.
- A real, working, deployed coded agent on Qwen with a clean dashboard, built solo in a single build session.
- Honest engineering: a deterministic fallback so the demo is crash-proof, and the restraint logic is transparent and auditable.

## What we learned

- The most valuable thing an autonomous agent can do is know when not to act. Coverage of the routine cases is table stakes; trust comes from the restraint on the risky ones.
- Qwen plus a thin deterministic guardrail is a strong pattern for agentic decisions where a wrong auto-action is costly.

## What's next for Gatekeeper

- Wire a side-effecting write integration to a real commerce or ticketing backend (Shopify, Zendesk) to execute the approvals. That is intentionally out of scope for this submission — Gatekeeper's contribution is the trustworthy decision, and acting on it is the deliberate next step, not a missing piece.
- Learn the escalation thresholds from human overrides over time.
- Add a second judgment category for chargebacks and disputes.
