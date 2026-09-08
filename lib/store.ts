import { Redis } from "@upstash/redis";
import type { Tone } from "@/lib/excuses";

// A single saved excuse for a (situation, tone) pair.
export interface StoredExcuse {
  id: string;
  text: string;
  label: string;
  copies: number;
  quality: boolean;
}

// Lazily construct the client so importing this module never requires the env
// vars (keeps builds and the no-store fallback path working). The Upstash REST
// client is HTTP-based and safe to use from serverless functions.
let client: Redis | null = null;
function redis(): Redis {
  if (!client) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error("KV_REST_API_URL / KV_REST_API_TOKEN are not set");
    }
    client = new Redis({ url, token });
  }
  return client;
}

// Normalize so "Missed a Wedding" and "missed a wedding" share one bucket.
function keyFor(situation: string, tone: Tone): string {
  const s = situation.trim().toLowerCase();
  return `excuses:${s}::${tone}`;
}

// @upstash/redis auto-serializes objects to JSON on set and parses on get.
async function readAll(situation: string, tone: Tone): Promise<StoredExcuse[]> {
  const value = await redis().get<StoredExcuse[]>(keyFor(situation, tone));
  return Array.isArray(value) ? value : [];
}

async function writeAll(
  situation: string,
  tone: Tone,
  items: StoredExcuse[],
): Promise<void> {
  await redis().set(keyFor(situation, tone), items);
}

// Append newly generated excuses; returns the created records (with ids) so the
// caller can hand ids back to the client for later flagging.
export async function seedExcuses(
  situation: string,
  tone: Tone,
  items: { text: string; label: string }[],
): Promise<StoredExcuse[]> {
  const existing = await readAll(situation, tone);
  const created: StoredExcuse[] = items.map((it) => ({
    id: crypto.randomUUID(),
    text: it.text,
    label: it.label,
    copies: 0,
    quality: false,
  }));
  await writeAll(situation, tone, [...existing, ...created]);
  return created;
}

// Bump copy count and promote to quality for one excuse by id.
// Returns false if the id wasn't found for that pair.
export async function flagExcuse(
  situation: string,
  tone: Tone,
  id: string,
): Promise<boolean> {
  const all = await readAll(situation, tone);
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  all[idx] = { ...all[idx], copies: all[idx].copies + 1, quality: true };
  await writeAll(situation, tone, all);
  return true;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pick up to n saved excuses for the pair, preferring quality-flagged ones,
// filling the rest with random non-flagged. Returns [] if nothing is stored.
export async function pickFallback(
  situation: string,
  tone: Tone,
  n = 3,
): Promise<StoredExcuse[]> {
  const all = await readAll(situation, tone);
  if (all.length === 0) return [];

  const quality = shuffle(all.filter((e) => e.quality));
  const rest = shuffle(all.filter((e) => !e.quality));
  return [...quality, ...rest].slice(0, n);
}
