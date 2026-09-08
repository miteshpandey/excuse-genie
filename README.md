# Excuse Genie

A small Next.js app that generates excuses from a chosen situation and tone.

Current state: the generation is mocked. The UI, the API route, and the full
request cycle all work end to end. Wiring the live model is the next step and is
isolated to one function, so nothing else changes when it lands.

## Stack

- Next.js (App Router) with TypeScript
- Tailwind CSS
- One API route at `app/api/generate` (POST)

## Run locally

Requires Node 18 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How it fits together

- `components/ExcuseGenie.tsx` is the UI. It posts `{ situation, tone }` to the
  API route and renders the returned excuses.
- `app/api/generate/route.ts` validates the input and returns excuses.
- `lib/excuses.ts` holds the situation and tone lists and `generateExcuses`,
  which is currently a mocked template bank.

## Wiring the live model (next step)

The mock lives in `generateExcuses` in `lib/excuses.ts` and is called from the
API route. Swapping to a real model means replacing that one call in the route
with a provider call. The planned provider is Google Gemini Flash via the Vercel
AI SDK. When that lands:

1. Copy `.env.example` to `.env.local` and paste your Google AI Studio key.
2. On Vercel, add the same key as an environment variable.

Do not commit `.env.local`.

## Deploy

Push this repo to GitHub, then import it into Vercel. Vercel auto-detects
Next.js and deploys on every push.
