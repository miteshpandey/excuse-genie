# Excuse Genie

A small Next.js app that generates excuses from a chosen situation and tone.

Generation is live: it calls Google Gemini through the Vercel AI SDK and returns
three excuses, each with a short style label. Real results are cached in a Redis
store, so when the model is unavailable (rate limit, timeout, outage) the app
serves genuine past output for the same situation and tone instead of failing.

## Stack

- Next.js (App Router) with TypeScript
- Tailwind CSS
- Vercel AI SDK (`ai`) with the Google provider (`@ai-sdk/google`)
- Upstash Redis (`@upstash/redis`), provisioned through the Vercel Marketplace
- Two API routes: `app/api/generate` (POST) and `app/api/flag` (POST)

## How it fits together

- `components/ExcuseGenie.tsx` is the UI. It posts `{ situation, tone }` to the
  generate route, shows a skeleton loader while waiting, and renders the three
  returned excuses. Copying an excuse fires a background call to the flag route.
- `app/api/generate/route.ts` validates input, calls the model, and returns the
  excuses. It also runs the fallback chain (below) and seeds the store.
- `app/api/flag/route.ts` records a copy: it bumps that excuse's copy count and
  promotes it to "quality" so it is preferred as a future fallback.
- `lib/store.ts` is the Redis layer: seed, read, flag, and the fallback picker.
- `lib/excuses.ts` holds the situation and tone lists plus `generateExcuses`,
  the base template bank used only as a last resort.

## Generation flow

Every request resolves in one of three ways, reported in a `source` field on the
response so you can tell them apart in the Network tab:

1. `live`: the model answered. The three results are saved to the store, and
   their ids are returned so the client can flag them on copy.
2. `store`: the model was unavailable, so three saved excuses for that exact
   situation and tone are served instead (see the fallback rules below).
3. `template`: the model was unavailable and the store had nothing for that
   pair, so the base templates are used. These have no id and cannot be flagged.

### Model call

`app/api/generate/route.ts` uses `generateObject` with a JSON schema, so the
model returns exactly three `{ label, text }` items. Key settings:

- `MODEL` is a single constant at the top (`gemini-3.5-flash-lite`). Confirm the
  exact id is live in Google AI Studio before changing it.
- `abortSignal: AbortSignal.timeout(18000)` caps the call below Vercel's 30s
  function limit, so a slow request drops to the fallback instead of erroring.
- `maxRetries: 0`, because a quota or rate-limit error never recovers on retry.

Flash-Lite does no thinking by default, which keeps latency low. If you switch to
a thinking-capable model and hit timeouts, either lower its thinking level via
`providerOptions.google.thinkingConfig` or raise `maxDuration` and the abort.

### Store and fallback rules

`lib/store.ts` keys everything on the normalized pair, for example
`excuses:missed a wedding::dramatic`, mapping to a JSON array of
`{ id, text, label, copies, quality }`. A companion `recent:` key per pair tracks
recently served ids.

When serving from the store, `pickFallback`:

- Prefers quality-flagged excuses, then fills the rest at random.
- Skips recently served ones using a no-repeat window that scales with how much
  is stored, roughly 10 percent (100 stored skips the last 10, 30 skips the last
  3). If the eligible pool cannot fill three, it tops up from the least recently
  served so it still returns three whenever at least three exist.

### Quality signal

There is no manual curation. When a user copies an excuse, the client calls the
flag route, which increments that excuse's copy count and sets `quality: true`.
Copies are the quality signal, so fallbacks drift toward what people actually use.

## UI behavior

- Auto-generate: picking a situation chip or a tone, or typing a custom
  situation (debounced), generates as soon as both a situation and a tone are
  set. It does not re-fire for an identical selection. "Surprise me" always
  regenerates.
- Loader: a skeleton placeholder shows while a request is in flight, so there is
  no blank gap during the wait.
- Copy: each excuse has a copy button with success and failure states, using the
  Clipboard API with a textarea fallback for restricted contexts.

## Environment variables

- `GOOGLE_GENERATIVE_AI_API_KEY`: your Google AI Studio key, used by the model
  call. Add it in Vercel under Settings, Environment Variables, for the
  environment you deploy.
- `KV_REST_API_URL` and `KV_REST_API_TOKEN`: injected automatically by the
  Upstash Marketplace integration. The store reads these. No manual setup beyond
  provisioning the Upstash database through the Vercel dashboard.

For local runs, copy `.env.example` to `.env.local` and fill these in. Do not
commit `.env.local`. Without the Google key, generation falls back to the store
or templates. Without the KV vars, the store is skipped and generation goes
straight to live or templates.

## Run locally

Requires Node 18 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

Push this repo to GitHub, then import it into Vercel. Vercel auto-detects
Next.js and deploys on every push. Make sure the Google key is set as an
environment variable and the Upstash database is provisioned through the
Marketplace so the KV variables are present.

## Known limitations

- Free-tier model quotas are per day and shared across all users. When you run
  out, the app serves from the store, which is the point of the cache. Only when
  the store is also empty for a pair do you get the base templates.
- The base templates slot the raw situation into a sentence, so for the preset
  chips (past-tense phrases) they can read awkwardly. They are a last resort
  only; the store is meant to cover the preset pairs well before this shows.
- Typed-in custom situations rarely get a store hit, so when the model is
  unavailable they tend to fall through to the templates.
- Store writes (seed and flag) are read-modify-write on a JSON array, so a rare
  simultaneous write to the same pair could lose one update. Harmless at this
  scale.
