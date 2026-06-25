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

The triage call comes from Qwen, but the **restraint guardrail** (`lib/policy.ts` + `lib/agent.ts`) is deterministic and sits on top of the model. Even if the model confidently returns `approve` on the $1,240 TV or a customer with four refunds this month, the guardrail overrides it to `escalate` when any of these hold:

- self-reported **confidence < 0.78** → escalate
- **amount > $500** (high-value) → escalate
- any **blocking risk flag** (`serial-refunder`, `suspected-fraud`, `conflicting-evidence`, `policy-ambiguous`, `chargeback-risk`) → escalate

The guardrail is a **one-way ratchet**: it can only ever make a decision *safer* (push it to `escalate`), never less safe — it cannot turn an escalate into an auto-action. So a confidently-wrong model can never auto-action a risky refund. The UI shows exactly when this fires: *"the model proposed approve, Gatekeeper held back and escalated instead."* That is the whole idea. An autopilot you can trust because it knows its limits.

## How it's built

- **Qwen (`qwen-max`) on Qwen Cloud** is the reasoning engine, called through the OpenAI-compatible Alibaba Cloud DashScope endpoint (`https://dashscope-intl.aliyuncs.com/compatible-mode/v1`) with `temperature: 0` and structured JSON output. Proof of Qwen Cloud deployment: [`lib/qwen.ts`](lib/qwen.ts) + the live call in [`lib/agent.ts`](lib/agent.ts).
- **Tool-calling:** the agent invokes a real Qwen **function call**, `assess_customer_risk`, to fetch deterministic risk signals (prior refunds, serial-refunder status, reason-vs-condition conflict) instead of guessing them from free text. The decision card shows which tool was called.
- **The restraint guardrail** (`lib/policy.ts` + `applyRestraint` in `lib/agent.ts`) is the deterministic safety net that guarantees escalation on risky cases.
- **Next.js (App Router) + TypeScript + Tailwind** for the dashboard and the `/api/triage` route.
- A **key-free deterministic fallback** keeps the app running before the Qwen credits land and if the API is ever unavailable, so the demo never crashes.

This is a **coded agent** (an explicit generate → tool-call → decide loop in TypeScript) rather than a low-code agent.

## Tests & aggregate evidence

The safety property is unit-tested. `npm test` (Vitest) pins the guardrail invariants — high-value, low-confidence, and blocking flags all force escalation; a clean case passes through; and an `escalate` is never downgraded to an auto-action — plus end-to-end checks over the demo queue. See [`tests/restraint.test.ts`](tests/restraint.test.ts).

Beyond the one $1,240 anecdote, [`public/benchmark.json`](public/benchmark.json) (regenerate with `npx tsx scripts/aggregate.ts`) is a committed aggregate over the whole queue: **8 cases → 5 auto-resolved, 3 escalated, 3 of which the guardrail held back** from a model auto-action. It quantifies how much routine work is cleared and how often restraint fires.

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
