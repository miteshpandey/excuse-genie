import { NextResponse } from "next/server";
import { generateExcuses, isTone } from "@/lib/excuses";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const situation =
      typeof body?.situation === "string" ? body.situation.trim() : "";
    const tone = body?.tone;

    if (!situation || !isTone(tone)) {
      return NextResponse.json(
        { error: "situation (non-empty string) and a valid tone are required" },
        { status: 400 },
      );
    }

    // MOCKED. Step 4: replace generateExcuses with a live model call here.
    const excuses = generateExcuses(situation, tone);

    return NextResponse.json({ situation, tone, excuses });
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
}
