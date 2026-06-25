# Devpost submission text: Gatekeeper

**Name:** Gatekeeper
**Tagline:** The refund autopilot that knows when to stop. An autonomous triage agent on Qwen that clears the routine cases and refuses to act on the risky ones.
**Track:** Autopilot Agent
**Built with:** Qwen, Qwen Cloud, Next.js, TypeScript, React, Tailwind, OpenAI-compatible API, Claude Code

---

## Inspiration

Refund and dispute triage is exactly the kind of high-volume, judgment-heavy work teams want to automate. The trap is that an agent which just auto-approves and auto-denies everything will, sooner or later, confidently refund a fraudster or reject a legitimate customer. The dangerous failure is not a slow agent, it is an autopilot that acts when it should have stopped. I wanted to build an autopilot you can actually trust, one that knows the difference between a clear case it can handle and a risky one it should hand to a human.

## What it does

You give Gatekeeper a queue of refund requests, each with the amount, item condition, stated reason, days since purchase, and customer history. For each one:

- Clear and safe cases (defective item in the window, unopened return, obvious policy match) are auto-approved or auto-denied on the spot.
- Risky or uncertain cases (high value, possible serial refunder, a stated reason that conflicts with the item, ambiguous policy, low confidence) are refused and escalated to a human, with the reasoning and the risk flags attached.

A person only ever looks at the escalation queue. Everything else is resolved automatically.

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

- The guardrail demonstrably catches a confidently-wrong auto-action: on a 1,240 dollar TV, Qwen returned approve at 90 percent confidence, and Gatekeeper held it back and escalated it instead. That moment is visible right in the UI.
- A real, working, deployed coded agent on Qwen with a clean dashboard, built solo in a single build session.
- Honest engineering: a deterministic fallback so the demo is crash-proof, and the restraint logic is transparent and auditable.

## What we learned

- The most valuable thing an autonomous agent can do is know when not to act. Coverage of the routine cases is table stakes; trust comes from the restraint on the risky ones.
- Qwen plus a thin deterministic guardrail is a strong pattern for agentic decisions where a wrong auto-action is costly.

## What's next for Gatekeeper

- Wire it to a real commerce or ticketing backend (Shopify, Zendesk) and act on the approvals.
- Learn the escalation thresholds from human overrides over time.
- Add a second judgment category for chargebacks and disputes.
