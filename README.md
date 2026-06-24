# Gatekeeper: the refund autopilot that knows when to stop

> **Global AI Hackathon Series with Qwen Cloud · Track: Autopilot Agent · built solo with Claude Code.**

Refund and dispute triage is the kind of high-volume, judgment-heavy work teams want to automate. The catch: an agent that auto-approves and auto-denies everything will, sooner or later, confidently refund a fraudster or reject a legitimate customer. The dangerous failure is not slowness, it is an autopilot that acts when it should have stopped.

**Gatekeeper is an autonomous refund-triage agent built on Qwen that clears the routine cases on its own and refuses to act on the risky ones**, escalating them to a human with its reasoning and risk flags attached.

![Architecture](public/architecture.svg)

## What it does

Give it a queue of refund requests (amount, item condition, stated reason, days since purchase, customer history). For each one:

- **Clear and safe** (defective item in window, unopened return, obvious policy match): Gatekeeper **auto-approves or auto-denies** it.
- **Risky or uncertain** (high-value, possible serial refunder, stated reason conflicts with the item, ambiguous policy, low confidence): it **refuses to act** and **escalates to a human**, with the reasoning and the flags that triggered the hold.

A human only ever sees the escalation queue. Everything else is resolved automatically.

## The differentiator: restraint enforced in code, not just asked for in a prompt

The triage call comes from Qwen, but the **restraint guardrail** (`lib/policy.ts` + `lib/agent.ts`) is deterministic and sits on top of the model. Even if the model confidently returns `approve` on a $1,200 order or a customer with four refunds this month, the guardrail overrides it to `escalate`:

- self-reported confidence below the threshold → escalate
- amount above the high-value limit → escalate
- any blocking risk flag (serial-refunder, suspected-fraud, conflicting-evidence, policy-ambiguous) → escalate

So a confidently-wrong model can never auto-action a risky refund. The UI shows exactly when this fires: *"the model proposed approve, Gatekeeper held back and escalated instead."* That is the whole idea. An autopilot you can trust because it knows its limits.

## How it's built

- **Qwen (Qwen Cloud)** is the reasoning engine, called through the OpenAI-compatible endpoint (`https://dashscope-intl.aliyuncs.com/compatible-mode/v1`) with structured JSON output. See `lib/agent.ts`.
- **The restraint guardrail** (`lib/policy.ts`) is the deterministic safety net that guarantees escalation on risky cases.
- **Next.js (App Router) + TypeScript + Tailwind** for the dashboard and the `/api/triage` route.
- A **key-free deterministic fallback** keeps the app running before the Qwen credits land and if the API is ever unavailable, so the demo never crashes.

This is a **coded agent** (an explicit triage loop in TypeScript) rather than a low-code agent.

## Run it locally

```bash
npm install
cp .env.example .env     # add your Qwen Cloud (DASHSCOPE) API key
npm run dev              # http://localhost:3000
```

Click **Run Gatekeeper on the queue**. With a valid key it uses live Qwen; without one it runs the deterministic fallback so you can still see the full flow. Pick your model in `.env` (`QWEN_MODEL`, e.g. `qwen-max`).

## What's next

- Wire it to a real ticketing or commerce backend (Shopify, Zendesk) and act on the approvals.
- Learn the escalation thresholds from human overrides over time.
- Add a second judgment category for disputes and chargebacks.

Built solo with **Claude Code**.
