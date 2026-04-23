# Grimace FC — Cloudflare Worker + D1

Grimace FC now runs as a Cloudflare Worker serving both:
- the built React/Vite frontend (`dist` assets)
- JSON API routes under `/api/*`

Shared app state is now persisted in **Cloudflare D1**.

## Architecture

- Frontend: React + Vite (mobile-first UI)
- Backend: Cloudflare Worker (`worker/index.ts`)
- Database: Cloudflare D1 (`env.DB` binding)
- No auth (all users can edit)

## Database schema & seeds

Migrations live in `migrations/`:
- `0001_init.sql` — schema
- `0002_seed.sql` — sample data (5+ rows per table)

No static JSON data files are used in production. D1 is the single source of truth.

Tables:
- users
- events
- messages
- fines
- lineups
- availability
- ref_roster
- next_ref_state
- next_ref_passes
- next_ref_history

## API endpoints

- `GET /api/events`
- `GET /api/next-game`
- `GET /api/users`
- `GET /api/messages`
- `POST /api/messages`
- `GET /api/fines`
- `POST /api/fines`
- `GET /api/lineup?eventId=`
- `POST /api/lineup`
- `GET /api/availability`
- `POST /api/availability`
- `POST /api/users/upsert`
- `GET /api/next-ref`
- `POST /api/next-ref/pass`
- `POST /api/next-ref/accept`
- `POST /api/next-ref/complete`
- `GET /api/next-ref/history`

All endpoints return JSON and include permissive CORS headers.


## Example `env.DB` queries

```ts
// read
const events = await env.DB.prepare('SELECT * FROM events ORDER BY date ASC').all();

// write with bind parameters
await env.DB
  .prepare('INSERT INTO messages (id, user_id, text, created_at) VALUES (?1, ?2, ?3, ?4)')
  .bind(id, userId, text, new Date().toISOString())
  .run();
```

## Frontend data behavior

- App data is fetched from Worker API (D1 source of truth)
- Writes (messages/fines/lineup/users/availability) are sent via POST routes
- Next referee duty is handled via `/api/next-ref*` routes and tied to the next upcoming away game
- localStorage is now only used for:
  - current user id
  - optional UI preferences

## Local development

```bash
npm install
npm run dev
```

Run worker locally:

```bash
npm run cf:dev
```

## D1 migration/seed

```bash
npm run db:migrate
npm run db:seed
```

## Build and deploy (Cloudflare only)

```bash
npm run build
npm run cf:deploy
```

`wrangler.jsonc` is configured to:
- use `env.DB` binding
- serve SPA assets from `dist`
- keep `/api/*` in Worker runtime


## Basic protection

The Worker includes a pragmatic protection stack:

- **IP rate limiting (in-memory)**
  - Reads (`GET`/`HEAD`): 60 req/min/IP
  - Writes (`POST`/`PUT`/`PATCH`/`DELETE`): 20 req/min/IP
  - Returns `429` JSON and `Retry-After`
- **Short-lived caching for read APIs**
  - `/api/events`, `/api/next-game`: 60s
  - `/api/messages`, `/api/fines`, `/api/lineup`: 20s
  - `/api/next-ref`, `/api/next-ref/history`: no-store
- **Query caps + ordering**
  - messages/fines/events capped to predictable limits
- **Debounced frontend polling**
  - messages refresh at most every ~10s (12s interval)
  - broader data refresh at most every ~30s (45s interval)
- **Write passcode protection**
  - all write routes require `x-team-passcode`
  - server verifies against `env.TEAM_PASSCODE`

### Set the team passcode secret

```bash
wrangler secret put TEAM_PASSCODE
```

Use this value when prompted:

```text
foleycanseeinthedark
```

### Rate limit tradeoff

Current IP rate limiting is isolate-local in memory. This is intentionally simple and lightweight, but not globally consistent across all Worker isolates/instances. The helper is structured to be swapped later for KV or Durable Objects when stronger global enforcement is needed.
