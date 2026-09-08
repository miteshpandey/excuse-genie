export type Tone = "sincere" | "funny" | "dramatic" | "corporate" | "unhinged";

export const SITUATIONS = [
  "missed a wedding",
  "ghosted a match",
  "skipped the gym",
  "missed a deadline",
  "forgot a birthday",
] as const;

export const TONES: Tone[] = [
  "sincere",
  "funny",
  "dramatic",
  "corporate",
  "unhinged",
];

export interface Excuse {
  label: string;
  text: string;
}

// MOCKED generation. Step 4 replaces the body of generateExcuses with a
// live model call; the situation/tone lists and Excuse shape stay the same.
const BANK: Record<Tone, (s: string) => string[]> = {
  sincere: (s) => [
    `I genuinely tried to make it happen for ${s}, but I got stuck in a spiral of overthinking exactly how to explain myself, and never came out the other side.`,
    `The honest truth about ${s} is that I underestimated how much I'd need a nap that day, and the nap won.`,
    `I owe you the real story about ${s}, which is that I procrastinated the plan until it stopped being a plan.`,
  ],
  funny: (s) => [
    `A squirrel outside my window looked like it needed emotional support, and that took priority over ${s}.`,
    `I was going to handle ${s}, but then I remembered I don't do that.`,
    `In my defense, ${s} required main character energy I simply did not have loaded that day.`,
  ],
  dramatic: (s) => [
    `The stars themselves conspired against ${s}, and who am I to defy the cosmos.`,
    `I stood at the crossroads of destiny and ${s}, and destiny lost.`,
    `Nothing could have prepared me for the sheer weight of ${s} on that fateful day.`,
  ],
  corporate: (s) => [
    `I made the strategic decision to deprioritize ${s} in favor of higher impact initiatives.`,
    `Following a resourcing review, ${s} was moved out of scope for this quarter.`,
    `I am circling back on ${s} once bandwidth opens up on my end.`,
  ],
  unhinged: (s) => [
    `I saw a pigeon and it changed the entire trajectory of my day, ${s} included.`,
    `Something about ${s} made me question the nature of time itself, so I sat with that instead.`,
    `I was fully prepared for ${s} until I was suddenly and inexplicably not.`,
  ],
};

const STYLE_LABELS: Record<Tone, string[]> = {
  sincere: ["too honest", "the real reason", "confession"],
  funny: ["deadpan", "classic", "self aware"],
  dramatic: ["soap opera", "tragic", "epic"],
  corporate: ["performance review", "stakeholder update", "quarterly recap"],
  unhinged: ["unfiltered", "chaotic", "concerning but harmless"],
};

export function generateExcuses(situation: string, tone: Tone): Excuse[] {
  const lines = BANK[tone](situation);
  const labels = STYLE_LABELS[tone];
  return lines.map((text, i) => ({ label: labels[i] ?? "", text }));
}

export function isTone(value: unknown): value is Tone {
  return typeof value === "string" && (TONES as string[]).includes(value);
}
