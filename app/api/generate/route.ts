import { NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject, jsonSchema } from "ai";
import {
  generateExcuses,
  isTone,
  type Tone,
  type Excuse,
} from "@/lib/excuses";

// Give the model call room to finish on the serverless function.
export const maxDuration = 30;

// The model string is the one thing you may want to change later. Any current
// free Gemini Flash model works (e.g. "gemini-2.5-flash-lite" for lower latency,
// or a newer flash id once you confirm it in Google AI Studio).
const MODEL = "gemini-3.6-flash";

const TONE_GUIDE: Record<Tone, string> = {
  sincere: "earnest and self-aware, owning up to a real but relatable failing",
  funny: "light and absurd with deadpan comic timing",
  dramatic: "overwrought and theatrical, like a soap-opera monologue",
  corporate: "buzzword-laden business-speak, deflecting as if in a meeting",
  unhinged: "chaotic and surreal but harmless, a strange tangent that derailed the day",
};

const schema = jsonSchema<{ excuses: { label: string; text: string }[] }>({
  type: "object",
  additionalProperties: false,
  required: ["excuses"],
  properties: {
    excuses: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "text"],
        properties: {
          label: {
            type: "string",
            description:
              "A short playful style tag, 2 to 4 words, lowercase, fitting the tone",
          },
          text: {
            type: "string",
            description:
              "The excuse itself, first person, one or two sentences",
          },
        },
      },
    },
  },
});

export async function POST(req: Request) {
  let situation = "";
  let tone: unknown;

  try {
    const body = await req.json();
    situation =
      typeof body?.situation === "string" ? body.situation.trim() : "";
    tone = body?.tone;
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  if (!situation || !isTone(tone)) {
    return NextResponse.json(
      { error: "situation (non-empty string) and a valid tone are required" },
      { status: 400 },
    );
  }

  try {
    const { object } = await generateObject({
      model: google(MODEL),
      schema,
      temperature: 0.9,
      system:
        "You write short, believable, entertaining excuses for everyday social and work situations. " +
        "Given a situation and a tone, return exactly three distinct excuses. " +
        "Each excuse has a short playful style label and the excuse text in the first person, one or two sentences. " +
        "Keep everything harmless and lighthearted. Never suggest anything unsafe, illegal, or genuinely hurtful to another person.",
      prompt:
        `Situation: ${situation}\n` +
        `Tone: ${tone} (${TONE_GUIDE[tone]})\n\n` +
        `Write three excuses in this tone.`,
    });

    const excuses: Excuse[] = object.excuses
      .slice(0, 3)
      .map((e) => ({ label: e.label, text: e.text }));

    return NextResponse.json({ situation, tone, excuses });
  } catch (err) {
    // Model unavailable (no key set, rate limited, or provider outage):
    // fall back to the local bank so the app always returns something.
    console.error("generate: model call failed, falling back to local bank", err);
    const excuses = generateExcuses(situation, tone);
    return NextResponse.json({ situation, tone, excuses });
  }
}
