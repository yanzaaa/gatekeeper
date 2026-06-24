# Gatekeeper demo script (~3 min, read word for word)

SETUP before you hit record:
- Open https://gatekeeper-ochre.vercel.app in a clean, full browser window.
- Cmd-Shift-5 to record, click Options, turn Microphone ON.
- Keep this script on your phone so it is not on screen.
- Read at a calm pace. The ... marks are short pauses.

Legend: [DO] = what to click. The rest in quotes is what you SAY.

---

## 1) HOOK   [DO: be on the page, nothing clicked yet]
"Every team wants to automate refund and dispute triage. It is high volume and repetitive. But here is the trap. An agent that just auto-approves and auto-denies everything will, sooner or later, confidently refund a fraudster, or reject a real customer. The dangerous failure is not a slow agent. It is an autopilot that acts when it should have stopped. So I built Gatekeeper, on Qwen. An autopilot that knows when to stop."

## 2) RUN IT   [DO: click "Run Gatekeeper on the queue"]
"Here is a queue of refund requests. Each one has the amount, the item condition, the customer's reason, the days since purchase, and their history. I hit run, and Gatekeeper takes each one to Qwen, which reasons over our refund policy and returns a decision. Approve, deny, or escalate, with a confidence score and its reasoning. Watch the queue resolve itself."

## 3) THE AUTO-RESOLVES   [DO: point at a green card, then a red card]
"The clear cases it just handles. This damaged item, inside the window, first-time buyer ... auto-approved. This used item returned after 41 days, past the window ... auto-denied, and notice it cites the exact policy reason. That is the routine work, gone. No human needed."

## 4) THE ESCALATIONS   [DO: point at the amber cards]
"Now the interesting ones. An 899 dollar laptop. A customer with four refunds in the last 30 days. Gatekeeper does not guess on these. It refuses to act, and escalates them to a human, with the reasoning and the risk flags attached."

## 5) THE MONEY MOMENT   [DO: scroll to the $1,240 TV card. Point at the amber "held back" badge and the "held back" stat at the top]
"And here is the whole idea, in one card. This is a 1,240 dollar TV. Qwen looked at it and decided approve, at 95 percent confidence. But Gatekeeper held it back, and escalated it instead. Why? Because restraint here is not just asked for in a prompt. It is enforced in code. A deterministic guardrail sits on top of the model. High value, low confidence, or a fraud flag, and the auto-action is blocked. Every time. So a confidently wrong model can never auto-action a risky refund. Look at the header. Most resolved automatically, the rest escalated, and one auto-action the guardrail caught."

## 6) PROVE IT IS REAL   [DO: scroll to "Try your own request". Type a scenario, for example amount 1500, days 3, condition "opened", reason "it broke", history "first purchase". Click "Triage this one"]
"And this is not canned data. There is a box where you type any scenario, and it runs live through Qwen, right now. A 1,500 dollar item ... escalated, because it is over the limit. The agent is really reasoning, on whatever you give it."

## 7) HOW IT'S BUILT   [DO: stay on the page]
"Under the hood, Qwen on Qwen Cloud is the reasoning engine, called through the OpenAI-compatible endpoint with structured JSON. The restraint guardrail is deterministic TypeScript. It is a coded agent, deployed and live. And I built the whole thing solo, with Claude Code."

## 8) CLOSE   [DO: nothing]
"That is Gatekeeper. It clears the routine work, and raises its hand on the risky calls. The autopilot you can trust, because it knows its limits. Thanks for watching."

---
Timing: about 3 minutes. If you stumble, just re-say the line. The two shots that MUST land: the held-back $1,240 card in step 5, and the live "Try your own" run in step 6.
