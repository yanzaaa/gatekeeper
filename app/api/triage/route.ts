import { NextResponse } from "next/server";
import { triage } from "@/lib/agent";
import type { RefundRequest } from "@/lib/types";

export const runtime = "nodejs";

// Production hygiene for a public demo endpoint: a fixed-window per-IP rate limit (per serverless
// instance) plus strict payload validation, so a stray script can't drain the DashScope quota or
// feed the agent unbounded junk. The demo queue (8 requests/run) fits comfortably under the limit.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, { count: number; windowStart: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 10_000) hits.clear();
  const h = hits.get(ip);
  if (!h || now - h.windowStart > WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  h.count += 1;
  return h.count > MAX_PER_WINDOW;
}

// Free-text fields may be empty (the try-your-own panel allows it) but are length-capped.
const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const nonEmpty = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && v.length <= max;
const num = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

function validRequest(r: unknown): r is RefundRequest {
  if (!r || typeof r !== "object") return false;
  const q = r as Record<string, unknown>;
  return (
    nonEmpty(q.id, 40) &&
    text(q.customer, 120) &&
    text(q.orderId, 60) &&
    num(q.amount, 0, 1_000_000) &&
    text(q.currency, 8) &&
    text(q.category, 60) &&
    text(q.reason, 600) &&
    num(q.daysSincePurchase, 0, 3650) &&
    text(q.itemCondition, 200) &&
    text(q.customerHistory, 300)
  );
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rate limit exceeded; try again in a minute" }, { status: 429 });
  }
  try {
    const body = (await req.json().catch(() => null)) as { request?: unknown } | null;
    if (!body || !validRequest(body.request)) {
      return NextResponse.json({ error: "invalid refund request payload" }, { status: 400 });
    }
    const decision = await triage(body.request);
    return NextResponse.json({ decision });
  } catch (e) {
    console.error("triage failed:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
