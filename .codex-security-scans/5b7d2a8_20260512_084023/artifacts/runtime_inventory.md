# Runtime Inventory

Scan target: repository-wide scan of `C:\Users\plain\Github\GrimaceFC` at commit `5b7d2a8`.

## Primary Runtime Surfaces

- Cloudflare Worker entrypoint: `worker/index.ts`, default export `fetch()` routes `/api/*` to `handleApi()` and otherwise serves assets through `env.ASSETS`.
- Scheduled Worker job: `worker/index.ts` scheduled handler refreshes season ladder and initializes schema.
- React/Vite browser app: `src/main.tsx`, `src/App.tsx`, route pages under `src/pages/`, shared API client under `src/services/dataService.ts`.
- Browser service worker: `public/service-worker.js` handles push events and notification clicks.
- Cloudflare deployment/config: `wrangler.jsonc`, `.github/workflows/deploy-pages.yml`.
- D1 schema/seed/migrations: `migrations/master_seed.sql`, `migrations/0003_chat_reactions_and_message_edits.sql`, `migrations/0004_season_ladder_current.sql`, `migrations/0005_rev_messages.sql`.

## Entrypoints And Trust Boundaries

- HTTP API routes in `worker/index.ts`: `/api/events`, `/api/season-ladder`, `/api/admin/refresh-season-ladder`, `/api/next-game`, `/api/next-ref`, `/api/next-ref/history`, `/api/next-ref/pass`, `/api/next-ref/accept`, `/api/next-ref/skip`, `/api/next-ref/complete`, `/api/users`, `/api/users/upsert`, `/api/users/notification-preference`, `/api/push/vapid-public-key`, `/api/push/pending`, `/api/push/debug`, `/api/push/subscription`, `/api/messages`, `/api/messages/:id`, `/api/messages/:id/reactions`, `/api/lineup`, `/api/event-score`, `/api/availability`, `/api/availability/clear`.
- Authentication/authorization controls: `requireTeamPasscode()` gates write methods only; `requireAdminPasscode()` gates selected admin actions; `resolvePasscodeRole()` maps passcode strings to roles.
- Client identity/session: `src/utils/storage.ts` stores current user id, team passcode, and visitor session in `localStorage`; `src/services/dataService.ts` attaches `x-team-passcode` to write requests.
- Database/query boundary: D1 prepared statements in `worker/index.ts`; most value inputs are bound parameters. Dynamic SQL appears in schema migration field lists derived from introspected column names, not direct request data.
- Network fetch boundary: Worker sends web push requests to stored subscription endpoints and fetches a fixed Dribl ladder URL. Browser service worker fetches `/api/push/pending` with a subscription endpoint query string.
- Browser rendering boundary: React renders messages, names, maps, logos, and standings from API responses. Search found no `dangerouslySetInnerHTML`/`innerHTML` usage.
- Push boundary: subscription JSON and metadata are accepted from authenticated writes and stored in D1; queued push payloads are retrieved by endpoint.

## Security-Relevant Configuration

- `wrangler.jsonc` defines `TEAM_PASSCODE`, `VIEW_PASSCODE`, and `ADMIN_PASSCODE` in plaintext vars.
- `worker/index.ts` also has fallback passcodes for missing env vars.
- CORS allows all origins and allows the `x-team-passcode` header.
- Rate limiting is isolate-local in memory and keyed by `CF-Connecting-IP` plus read/write bucket.

## Exclusions

- `node_modules`, `dist`, `.wrangler`, generated TypeScript build info, local batch files, static image/icon binaries, docs, and one-off local merge tooling are excluded from detailed runtime review because they are generated, dependency, documentation, or developer-local surfaces rather than first-party deployed application logic.
