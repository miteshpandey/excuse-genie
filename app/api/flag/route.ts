import { NextResponse } from "next/server";
import { isTone } from "@/lib/excuses";
import { flagExcuse } from "@/lib/store";

export async function POST(req: Request) {
  let situation = "";
  let tone: unknown;
  let id = "";

  try {
    const body = await req.json();
    situation =
      typeof body?.situation === "string" ? body.situation.trim() : "";
    tone = body?.tone;
    id = typeof body?.id === "string" ? body.id : "";
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  if (!situation || !isTone(tone) || !id) {
    return NextResponse.json(
      { error: "situation, a valid tone, and id are required" },
      { status: 400 },
    );
  }

  try {
    const ok = await flagExcuse(situation, tone, id);
    return NextResponse.json({ ok });
  } catch (e) {
    console.error("flag: failed", e);
    return NextResponse.json({ ok: false });
  }
}