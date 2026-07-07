# Hypnosis Logger

Personal, single-user, mobile-first logger for one-on-one hypnosis sessions.
One voice dump (via Wispr Flow dictation) → Claude parses it into a structured
entry → follow-up questions only for missing required fields → saved. Built to
answer two questions reliably:

1. *What metaphors have I used for goal X, and how effective were they?* → **Metaphor Bank**
2. *When did I hypnotize person Y, and what did I do?* → **History search**

## Stack

- **Next.js (App Router)** on Vercel, PWA (installable on iPhone)
- **Postgres** via `DATABASE_URL` (Vercel Postgres / Neon / Supabase all work).
  With no `DATABASE_URL`, falls back to an embedded local database (PGlite in
  `./.data`) — for local dev only.
- **Anthropic API** (Claude Opus 4.8) for parsing voice dumps, with structured
  JSON output and goal-tag consistency (existing tags are fed into every parse).
- **Auth**: one access code (`ACCESS_CODE` env var) → year-long session cookie.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` — Postgres connection string (leave empty for local PGlite)
   - `ANTHROPIC_API_KEY` — required for parsing
   - `ACCESS_CODE` — your access code (leave empty to disable auth locally)
3. `npm run dev`

The `entries` table is created automatically on first use — no migration step.

### Deploy to Vercel

1. Import the repo in Vercel.
2. Add a Postgres database (Vercel Postgres/Neon marketplace or Supabase) and
   set `DATABASE_URL` (use the **pooler** URL for Supabase).
3. Set `ANTHROPIC_API_KEY` and `ACCESS_CODE` env vars.
4. Deploy. Open the URL on your iPhone in Safari → Share → **Add to Home
   Screen** to install it as an app.

## Screens

- **Log** (`/`) — big text area, dictate with Wispr Flow, tap Parse. Review the
  parsed card, tap any field to correct it, answer follow-ups (effectiveness →
  goal → metaphors → technique), Save. If the API is unreachable the dump is
  kept locally as *pending* and can be retried — a dump is never lost.
- **History** (`/history`) — reverse-chronological, instant search across
  people/goals/metaphors/notes, filter chips (goal tag, language, effectiveness
  range, date range). Tap → full detail with the original raw dump, Edit, Delete.
- **Metaphor Bank** (`/metaphors`) — metaphors grouped by goal tag, deduplicated
  with use counts, ranked by average effectiveness.
- **Stats** (`/stats`) — totals, month-over-month, average effectiveness +
  trend, language and goal breakdowns, top metaphors, days active/streak, and
  the **Export all data as JSON** button.

## Data model

Each entry: `date`, `location?`, `who?`, `language` (default English), `goal`*,
`goal_tag` (auto), `metaphors[]`*, `technique`*, `effectiveness` (1–10)*,
`notes?`, `raw_dump` (always preserved, viewable via "Show original"),
`incomplete` flag. Fields marked * are required — missing ones trigger
follow-up questions but can be force-saved with an *incomplete* badge.

## Regenerating PWA icons

`npm run gen-icons` (pure Node, no image dependencies).
