"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { QUEUE } from "@/lib/data";
import type { Decision, RefundRequest } from "@/lib/types";

const EASE = [0.32, 0.72, 0, 1] as const;
const fmt = (n: number, c: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

const META: Record<string, { label: string; tag: string; edge: string }> = {
  approve: { label: "Auto-approved", tag: "tag-approve", edge: "edge-approve" },
  deny: { label: "Auto-denied", tag: "tag-deny", edge: "edge-deny" },
  escalate: { label: "Escalated to human", tag: "tag-escalate", edge: "edge-escalate" },
};

type Cell = Decision | "loading" | undefined;

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
const item = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: EASE } },
};

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.75, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Tilt({ children, className }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [5.5, -5.5]), { stiffness: 220, damping: 18 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-5.5, 5.5]), { stiffness: 220, damping: 18 });
  return (
    <motion.div
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width - 0.5);
        y.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function DecisionBody({ d }: { d: Decision }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="mt-3 pt-3"
      style={{ borderTop: "1px solid var(--hair)" }}
    >
      <div className="text-[13.5px] text-[#dbe3ee]">{d.reasoning}</div>
      <div className="flex items-center gap-2 mt-2.5">
        <span className="text-[11px] text-[var(--mut)] w-[78px]">confidence</span>
        <div className="gk-bar flex-1"><span style={{ width: `${Math.round(d.confidence * 100)}%` }} /></div>
        <span className="gk-num text-[11px] text-[var(--mut)] w-[34px] text-right">{Math.round(d.confidence * 100)}%</span>
      </div>
      {d.riskFlags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {d.riskFlags.map((f) => (<span key={f} className="gk-flag">{f}</span>))}
        </div>
      )}
      {d.heldBack && (
        <div className="gk-held mt-2.5">
          ⚠ The model proposed <b>{d.rawAction}</b>, so Gatekeeper held back and escalated instead. {d.policyBasis}
        </div>
      )}
    </motion.div>
  );
}

export default function Page() {
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [running, setRunning] = useState(false);
  const [engine, setEngine] = useState<string>();
  const [form, setForm] = useState({
    amount: "1500",
    daysSincePurchase: "3",
    itemCondition: "opened",
    reason: "It broke after a couple of days.",
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
      id: "CUSTOM", customer: "You", orderId: "custom", amount: Number(form.amount) || 0,
      currency: "USD", category: "Custom", reason: form.reason,
      daysSincePurchase: Number(form.daysSincePurchase) || 0, itemCondition: form.itemCondition, customerHistory: form.customerHistory,
    };
    try { setCustom((await triage(r)) ?? undefined); } catch { setCustom(undefined); }
  }

  const done = Object.values(cells).filter((d): d is Decision => !!d && d !== "loading");
  const auto = done.filter((d) => d.action !== "escalate").length;
  const esc = done.filter((d) => d.action === "escalate").length;
  const held = done.filter((d) => d.heldBack).length;
  const escalated = done.filter((d) => d.action === "escalate");
  const customDec = custom && custom !== "loading" ? custom : null;
  const customMeta = customDec ? META[customDec.action] : null;

  return (
    <main className="max-w-[1120px] mx-auto px-6 py-20 md:py-28">
      {/* Hero */}
      <motion.div variants={container} initial="hidden" animate="show">
        <motion.div variants={item}>
          <span className="gk-eyebrow"><span className="dot" /> Qwen · Autopilot Agent</span>
        </motion.div>
        <motion.h1 variants={item} className="gk-title text-[clamp(52px,9vw,104px)] leading-[0.95] mt-5">
          Gatekeeper
        </motion.h1>
        <motion.p variants={item} className="text-[clamp(18px,2.2vw,23px)] text-[var(--mut)] mt-4 max-w-[46rem] leading-[1.5]">
          The refund autopilot that knows when to <span className="text-[var(--acc)] font-semibold">stop</span>.
          It clears the routine cases on its own and refuses to act on the risky ones, escalating to a human with its reasoning.
        </motion.p>
        <motion.div variants={item} className="flex flex-wrap items-center gap-3 mt-9">
          <button className="gk-btn" onClick={run} disabled={running}>
            <span>{running ? "Running the queue" : "Run Gatekeeper on the queue"}</span>
            <span className="ico">{running ? <span className="spin" /> : "▶"}</span>
          </button>
          <span className="gk-pill">{QUEUE.length} requests in queue</span>
          {engine && (
            <span className="gk-pill">engine: <b className="text-[var(--ink)]">{engine === "qwen" ? "Qwen (live)" : "fallback"}</b></span>
          )}
        </motion.div>
      </motion.div>

      {/* Stats */}
      {done.length > 0 && (
        <div className="grid grid-cols-3 gap-3.5 mt-12">
          <Stat n={auto} label="auto-resolved" color="var(--acc)" i={0} />
          <Stat n={esc} label="escalated to a human" color="var(--amber)" i={1} />
          <Stat n={held} label="auto-actions the guardrail held back" color="var(--acc2)" i={2} />
        </div>
      )}

      {/* Queue */}
      <Reveal className="gk-kicker mt-20 mb-4">The queue</Reveal>
      <div className="grid md:grid-cols-2 gap-3.5" style={{ perspective: 1200 }}>
        {QUEUE.map((r, idx) => {
          const cell = cells[r.id];
          const d = cell && cell !== "loading" ? cell : null;
          const m = d ? META[d.action] : null;
          return (
            <Reveal key={r.id} delay={Math.min(idx * 0.04, 0.3)}>
              <Tilt className={`glass p-5 ${m ? m.edge : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-semibold">
                      {r.customer} <span className="text-[var(--mut)] font-normal">· {r.id}</span>
                    </div>
                    <div className="gk-num text-[13px] text-[var(--mut)] mt-0.5">
                      {fmt(r.amount, r.currency)} · {r.category} · {r.daysSincePurchase}d · {r.itemCondition}
                    </div>
                  </div>
                  {cell === "loading" ? <div className="spin mt-1" /> : m ? <span className={`gk-tag ${m.tag}`}>{m.label}</span> : null}
                </div>
                <div className="text-[13.5px] text-[#cdd6e3] mt-2.5">&ldquo;{r.reason}&rdquo;</div>
                <div className="text-[12px] text-[var(--mut)] mt-0.5">history: {r.customerHistory}</div>
                {d && <DecisionBody d={d} />}
              </Tilt>
            </Reveal>
          );
        })}
      </div>

      {/* Human review */}
      {escalated.length > 0 && (
        <>
          <Reveal className="gk-kicker mt-20 mb-4">Human review queue ({escalated.length})</Reveal>
          <Reveal>
            <div className="glass p-5">
              <p className="text-[13.5px] text-[var(--mut)] mb-3">
                This is all a human ever has to look at. Everything else was resolved automatically.
              </p>
              <div className="flex flex-col gap-2">
                {escalated.map((d) => {
                  const r = QUEUE.find((q) => q.id === d.requestId)!;
                  return (
                    <div key={d.requestId} className="flex items-start justify-between gap-3 py-2.5" style={{ borderBottom: "1px solid var(--hair)" }}>
                      <div>
                        <div className="gk-num text-[14px] font-medium">{r.customer} · {fmt(r.amount, r.currency)} · {r.id}</div>
                        <div className="text-[12.5px] text-[var(--mut)]">{d.reasoning}</div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">{d.riskFlags.slice(0, 2).map((f) => <span key={f} className="gk-flag">{f}</span>)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </>
      )}

      {/* Try your own */}
      <Reveal className="gk-kicker mt-20 mb-4">Try your own request</Reveal>
      <Reveal>
        <div className="gk-shell">
          <div className={`gk-core p-5 ${customMeta ? customMeta.edge : ""}`}>
            <p className="text-[13px] text-[var(--mut)] mb-3.5">
              Not a canned demo. Type any refund scenario and send it through the live Qwen agent.
            </p>
            <div className="grid md:grid-cols-4 gap-2.5">
              <div><label className="gk-label">Amount (USD)</label><input className="gk-input gk-num" value={form.amount} inputMode="numeric" onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><label className="gk-label">Days since purchase</label><input className="gk-input gk-num" value={form.daysSincePurchase} inputMode="numeric" onChange={(e) => setForm({ ...form, daysSincePurchase: e.target.value })} /></div>
              <div className="md:col-span-2"><label className="gk-label">Item condition</label><input className="gk-input" value={form.itemCondition} onChange={(e) => setForm({ ...form, itemCondition: e.target.value })} /></div>
              <div className="md:col-span-2"><label className="gk-label">Customer&rsquo;s reason</label><input className="gk-input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
              <div className="md:col-span-2"><label className="gk-label">Customer history</label><input className="gk-input" value={form.customerHistory} onChange={(e) => setForm({ ...form, customerHistory: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button className="gk-btn" onClick={runCustom} disabled={custom === "loading"}>
                <span>{custom === "loading" ? "Thinking" : "Triage this one"}</span>
                <span className="ico">{custom === "loading" ? <span className="spin" /> : "▶"}</span>
              </button>
              {customMeta && <span className={`gk-tag ${customMeta.tag}`}>{customMeta.label}</span>}
            </div>
            {customDec && <DecisionBody d={customDec} />}
          </div>
        </div>
      </Reveal>

      <footer className="text-[12.5px] text-[var(--mut)] mt-20 pt-6" style={{ borderTop: "1px solid var(--hair)" }}>
        Gatekeeper · built on Qwen (Qwen Cloud) for the Global AI Hackathon · the autopilot you trust because it knows its limits.
      </footer>
    </main>
  );
}

function Stat({ n, label, color, i }: { n: number; label: string; color: string; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: EASE, delay: i * 0.08 }}
      className="glass px-5 py-5"
    >
      <div className="gk-num text-[40px] font-extrabold leading-none" style={{ color }}><CountUp n={n} /></div>
      <div className="text-[12.5px] text-[var(--mut)] mt-2">{label}</div>
    </motion.div>
  );
}

function CountUp({ n }: { n: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 520);
      setV(Math.round(p * n));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return <>{v}</>;
}
