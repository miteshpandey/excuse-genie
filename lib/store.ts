import { Redis } from "@upstash/redis";
import type { Tone } from "@/lib/excuses";

export interface StoredExcuse {
  id: string;
  text: string;
  label: string;
  copies: number;
  quality: boolean;
}

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

const RECENT_CAP = 200;

function norm(situation: string): string {
  return situation.trim().toLowerCase();
}
function keyFor(situation: string, tone: Tone): string {
  return `excuses:${norm(situation)}::${tone}`;
}
function recentKeyFor(situation: string, tone: Tone): string {
  return `recent:${norm(situation)}::${tone}`;
}

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

async function readRecent(situation: string, tone: Tone): Promise<string[]> {
  const value = await redis().get<string[]>(recentKeyFor(situation, tone));
  return Array.isArray(value) ? value : [];
}
async function pushRecent(
  situation: string,
  tone: Tone,
  ids: string[],
  known?: string[],
): Promise<void> {
  const recent = known ?? (await readRecent(situation, tone));
  const next = [...recent, ...ids].slice(-RECENT_CAP);
  await redis().set(recentKeyFor(situation, tone), next);
}

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
function tierShuffle(items: StoredExcuse[]): StoredExcuse[] {
  return [
    ...shuffle(items.filter((e) => e.quality)),
    ...shuffle(items.filter((e) => !e.quality)),
  ];
}

export async function pickFallback(
  situation: string,
  tone: Tone,
  n = 3,
): Promise<StoredExcuse[]> {
  const all = await readAll(situation, tone);
  if (all.length === 0) return [];

  const recent = await readRecent(situation, tone);

  if (all.length <= n) {
    const picked = tierShuffle(all).slice(0, n);
    await pushRecent(situation, tone, picked.map((e) => e.id), recent);
    return picked;
  }

  const window = Math.floor(all.length / 10);
  const blocked = new Set(window > 0 ? recent.slice(-window) : []);

  const eligible = all.filter((e) => !blocked.has(e.id));
  let pool = tierShuffle(eligible);

  if (pool.length < n) {
    const pos = new Map<string, number>();
    recent.forEach((id, i) => pos.set(id, i));
    const topup = all
      .filter((e) => blocked.has(e.id))
      .sort((a, b) => (pos.get(a.id) ?? -1) - (pos.get(b.id) ?? -1));
    pool = [...pool, ...topup];
  }

  const picked = pool.slice(0, n);
  await pushRecent(situation, tone, picked.map((e) => e.id), recent);
  return picked;
}
