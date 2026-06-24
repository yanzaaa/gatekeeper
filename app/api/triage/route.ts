import { NextResponse } from "next/server";
import { triage } from "@/lib/agent";
import type { RefundRequest } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { request?: RefundRequest };
    if (!body?.request?.id) {
      return NextResponse.json({ error: "missing request" }, { status: 400 });
    }
    const decision = await triage(body.request);
    return NextResponse.json({ decision });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
