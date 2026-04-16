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

Tables:
- users
- events
- messages
- fines
- lineups
- availability

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

## Build and deploy

```bash
npm run build
npm run cf:deploy
```

`wrangler.jsonc` is configured to:
- use `env.DB` binding
- serve SPA assets from `dist`
- keep `/api/*` in Worker runtime
