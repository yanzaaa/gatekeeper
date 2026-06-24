"use client";

import { useState } from "react";
import { QUEUE } from "@/lib/data";
import type { Decision, RefundRequest } from "@/lib/types";

const fmt = (n: number, c: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

const META: Record<string, { label: string; tag: string; edge: string }> = {
  approve: { label: "Auto-approved", tag: "tag-approve", edge: "gk-edge-approve" },
  deny: { label: "Auto-denied", tag: "tag-deny", edge: "gk-edge-deny" },
  escalate: { label: "Escalated to human", tag: "tag-escalate", edge: "gk-edge-escalate" },
};

type Cell = Decision | "loading" | undefined;

function DecisionBody({ d }: { d: Decision }) {
  return (
    <div className="mt-3 pt-3 border-t border-[var(--line)]">
      <div className="text-[13.5px] text-[#dbe3ee]">{d.reasoning}</div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[11px] text-[var(--mut)] w-[78px]">confidence</span>
        <div className="gk-bar flex-1">
          <span style={{ width: `${Math.round(d.confidence * 100)}%` }} />
        </div>
        <span className="text-[11px] text-[var(--mut)] w-[34px] text-right">{Math.round(d.confidence * 100)}%</span>
      </div>
      {d.riskFlags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {d.riskFlags.map((f) => (
            <span key={f} className="gk-flag">{f}</span>
          ))}
        </div>
      )}
      {d.heldBack && (
        <div className="gk-held mt-2">
          ⚠ The model proposed <b>{d.rawAction}</b>, so Gatekeeper held back and escalated instead. {d.policyBasis}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [running, setRunning] = useState(false);
  const [engine, setEngine] = useState<string>();

  // "Try your own" panel state
  const [form, setForm] = useState({
    amount: "750",
    daysSincePurchase: "5",
    itemCondition: "opened, possibly defective",
    reason: "It stopped working after a few days.",
    customerHistory: "first purchase",
  });
  const [custom, setCustom] = useState<Cell>();

  async function triage(r: RefundRequest): Promise<Decision | undefined> {
    const res = await fetch("/api/triage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: r }),
    });
    const { decision } = (await res.json()) as { decision: Decision };
    if (decision?.engine) setEngine(decision.engine);
    return decision;
  }

  async function run() {
    setRunning(true);
    setCells({});
    for (const r of QUEUE) {
      setCells((c) => ({ ...c, [r.id]: "loading" }));
      try {
        const d = await triage(r);
        setCells((c) => ({ ...c, [r.id]: d }));
      } catch {
        setCells((c) => ({ ...c, [r.id]: undefined }));
      }
    }
    setRunning(false);
  }

  async function runCustom() {
    setCustom("loading");
    const r: RefundRequest = {
      id: "CUSTOM",
      customer: "You",
      orderId: "custom",
      amount: Number(form.amount) || 0,
      currency: "USD",
      category: "Custom",
      reason: form.reason,
      daysSincePurchase: Number(form.daysSincePurchase) || 0,
      itemCondition: form.itemCondition,
      customerHistory: form.customerHistory,
    };
    try {
      setCustom((await triage(r)) ?? undefined);
    } catch {
      setCustom(undefined);
    }
  }

  const done = Object.values(cells).filter((d): d is Decision => !!d && d !== "loading");
  const auto = done.filter((d) => d.action !== "escalate").length;
  const esc = done.filter((d) => d.action === "escalate").length;
  const held = done.filter((d) => d.heldBack).length;
  const escalated = done.filter((d) => d.action === "escalate");
  const customDec = custom && custom !== "loading" ? custom : null;
  const customMeta = customDec ? META[customDec.action] : null;

  return (
    <main className="max-w-[1100px] mx-auto px-6 py-10">
      <div className="gk-kicker">Qwen · Autopilot Agent · refund &amp; dispute triage</div>
      <h1 className="text-[44px] leading-[1.04] font-extrabold tracking-tight mt-2">Gatekeeper</h1>
      <p className="text-[19px] text-[var(--mut)] mt-1 max-w-[42rem]">
        The refund autopilot that knows when to <span className="text-[var(--acc)] font-semibold">stop</span>.
        It clears the routine cases on its own and refuses to act on the risky ones, escalating to a human with its reasoning.
      </p>

      <div className="flex flex-wrap items-center gap-3 mt-6">
        <button className="gk-btn" onClick={run} disabled={running}>
          {running ? "Running…" : "▶ Run Gatekeeper on the queue"}
        </button>
        <span className="gk-pill">{QUEUE.length} requests in queue</span>
        {engine && (
          <span className="gk-pill">
            engine: <b className="text-[var(--ink)]">{engine === "qwen" ? "Qwen (live)" : "deterministic fallback"}</b>
          </span>
        )}
      </div>

      {done.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mt-6">
          <Stat n={auto} label="auto-resolved" color="var(--acc)" />
          <Stat n={esc} label="escalated to a human" color="var(--amber)" />
          <Stat n={held} label="auto-actions the guardrail held back" color="var(--acc2)" />
        </div>
      )}

      <h2 className="gk-kicker mt-10 mb-3">The queue</h2>
      <div className="grid md:grid-cols-2 gap-3">
        {QUEUE.map((r) => {
          const cell = cells[r.id];
          const d = cell && cell !== "loading" ? cell : null;
          const m = d ? META[d.action] : null;
          return (
            <div key={r.id} className={`gk-card p-4 ${m ? m.edge : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold">
                    {r.customer} <span className="text-[var(--mut)] font-normal">· {r.id}</span>
                  </div>
                  <div className="text-[13px] text-[var(--mut)] mt-0.5">
                    {fmt(r.amount, r.currency)} · {r.category} · {r.daysSincePurchase}d · {r.itemCondition}
                  </div>
                </div>
                {cell === "loading" ? (
                  <div className="spin mt-1" />
                ) : m ? (
                  <span className={`gk-tag ${m.tag}`}>{m.label}</span>
                ) : null}
              </div>

              <div className="text-[13.5px] text-[#cdd6e3] mt-2">&ldquo;{r.reason}&rdquo;</div>
              <div className="text-[12px] text-[var(--mut)] mt-0.5">history: {r.customerHistory}</div>

              {d && <DecisionBody d={d} />}
            </div>
          );
        })}
      </div>

      {escalated.length > 0 && (
        <>
          <h2 className="gk-kicker mt-10 mb-3">Human review queue ({escalated.length})</h2>
          <div className="gk-card p-4">
            <p className="text-[13.5px] text-[var(--mut)] mb-3">
              This is all a human ever has to look at. Everything else was resolved automatically.
            </p>
            <div className="flex flex-col gap-2">
              {escalated.map((d) => {
                const r = QUEUE.find((q) => q.id === d.requestId)!;
                return (
                  <div
                    key={d.requestId}
                    className="flex items-start justify-between gap-3 py-2 border-b border-[var(--line)] last:border-0"
                  >
                    <div>
                      <div className="text-[14px] font-medium">
                        {r.customer} · {fmt(r.amount, r.currency)} · {r.id}
                      </div>
                      <div className="text-[12.5px] text-[var(--mut)]">{d.reasoning}</div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {d.riskFlags.slice(0, 2).map((f) => (
                        <span key={f} className="gk-flag">{f}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Try your own */}
      <h2 className="gk-kicker mt-10 mb-3">Try your own request</h2>
      <div className={`gk-card p-4 ${customMeta ? customMeta.edge : ""}`}>
        <p className="text-[13px] text-[var(--mut)] mb-3">
          Not a canned demo. Type any refund scenario and send it through the live Qwen agent.
        </p>
        <div className="grid md:grid-cols-4 gap-2">
          <div>
            <label className="gk-label">Amount (USD)</label>
            <input className="gk-input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputMode="numeric" />
          </div>
          <div>
            <label className="gk-label">Days since purchase</label>
            <input className="gk-input" value={form.daysSincePurchase} onChange={(e) => setForm({ ...form, daysSincePurchase: e.target.value })} inputMode="numeric" />
          </div>
          <div className="md:col-span-2">
            <label className="gk-label">Item condition</label>
            <input className="gk-input" value={form.itemCondition} onChange={(e) => setForm({ ...form, itemCondition: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="gk-label">Customer&rsquo;s reason</label>
            <input className="gk-input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="gk-label">Customer history</label>
            <input className="gk-input" value={form.customerHistory} onChange={(e) => setForm({ ...form, customerHistory: e.target.value })} />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button className="gk-btn" onClick={runCustom} disabled={custom === "loading"}>
            {custom === "loading" ? "Thinking…" : "Triage this one"}
          </button>
          {customMeta && <span className={`gk-tag ${customMeta.tag}`}>{customMeta.label}</span>}
        </div>
        {customDec && <DecisionBody d={customDec} />}
      </div>

      <footer className="text-[12.5px] text-[var(--mut)] mt-12 pt-5 border-t border-[var(--line)]">
        Gatekeeper · built on Qwen (Qwen Cloud) for the Global AI Hackathon · the autopilot you trust because it knows its limits.
      </footer>
    </main>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="gk-card px-5 py-4">
      <div className="text-[34px] font-extrabold leading-none" style={{ color }}>{n}</div>
      <div className="text-[12.5px] text-[var(--mut)] mt-1.5">{label}</div>
    </div>
  );
}
