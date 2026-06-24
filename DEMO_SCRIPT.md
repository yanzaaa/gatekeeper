# Gatekeeper demo script (~3 min, hard cap from the rules)

Setup: app open at localhost:3000 (or the live Vercel URL). Big browser window. Mic on. Read naturally.

## 1) HOOK  (~25s)
"Every team wants to automate refund and dispute triage. It is high volume and repetitive. But here is the trap: an agent that just auto-approves and auto-denies everything will, sooner or later, confidently refund a fraudster or reject a real customer. The dangerous failure is not a slow agent. It is an autopilot that acts when it should have stopped. So I built Gatekeeper, on Qwen, an autopilot that knows when to stop."

## 2) RUN IT  (~35s)  [click "Run Gatekeeper on the queue"]
"Here is a queue of refund requests. Each has the amount, the item condition, the customer's reason, the days since purchase, and their history. I hit run, and Gatekeeper takes each one to Qwen, which reasons over our refund policy and returns a structured decision: approve, deny, or escalate, with a confidence score and its reasoning. Watch the queue resolve itself."

## 3) THE AUTO-RESOLVES  (~25s)  [point at the green and red cards]
"The clear cases it just handles. This damaged mug, in the window, first-time buyer, auto-approved. This used item returned after 41 days, past the window, auto-denied, and notice it cites the exact policy reason. That is the routine work, gone, no human needed."

## 4) THE ESCALATIONS  (~25s)  [point at the amber cards]
"Now the interesting ones. An 899 dollar laptop. A customer with four refunds in the last 30 days. An item whose stated reason conflicts with its condition. Gatekeeper does not guess on these. It refuses to act and escalates them to a human, with the reasoning and the risk flags attached."

## 5) THE MONEY MOMENT  (~35s)  [scroll to the $1,240 TV card, point at the held-back badge + the "held back" stat]
"And here is the whole idea in one card. This is a 1,240 dollar TV. Qwen looked at it, decided approve, and it was 95 percent confident. But Gatekeeper held it back and escalated it instead. Why? Because restraint here is not just asked for in a prompt, it is enforced in code. A deterministic guardrail sits on top of the model: high value, low confidence, or a fraud flag, and the auto-action is blocked, every time. So a confidently wrong model can never auto-action a risky refund. Look at the header: five resolved automatically, three escalated, and one auto-action the guardrail caught."

## 6) HOW IT'S BUILT  (~25s)
"Under the hood, Qwen on Qwen Cloud is the reasoning engine, called through the OpenAI-compatible endpoint with structured JSON output. The restraint guardrail is deterministic TypeScript. It is a coded agent, deployed and live. And I built the whole thing solo, with Claude Code."

## 7) CLOSE  (~15s)
"That is Gatekeeper. It clears the routine work and raises its hand on the risky calls. The autopilot you can trust, because it knows its limits. Thanks for watching."

---
Timing: ~3:05 of narration. If you stumble, re-say the line and trim. The held-back $1,240 card is the shot that has to land, so make sure it is on screen for step 5.

Optional 10-second beat (great for credibility): scroll to the "Try your own request" box, type any scenario, and click Triage this one. It runs live through Qwen, proving it is not canned data. Drop this in right after the money moment if you want.
