# Validation Report

## Validation Rubric

For each candidate, validation used these criteria:

- [ ] Attacker input is reachable through an in-scope runtime interface.
- [ ] The closest security control is absent, incomplete, exposed, or bound to attacker-controlled data.
- [ ] The sink or protected action changes confidentiality, integrity, availability, or deployment state.
- [ ] Counterevidence in neighboring code does not defeat this exact instance.
- [ ] Preconditions and proof gaps are explicit enough for remediation prioritization.

Runtime reproduction against the deployed Cloudflare Worker was not attempted because it would require production URL/secrets and could mutate live team data. Static trace plus built artifact/config evidence was sufficient for the high-confidence findings below.

## Candidate Assessments

### CAND-001: Hardcoded/default passcodes grant write and admin access

- Instance key: `default-credential:worker/index.ts:85`
- Ledger rows: RW-001, RW-003
- Confidence: high
- Validation method: static trace plus built bundle search.
- Rubric:
  - [x] Attacker input is reachable through `x-team-passcode` on all write/admin routes.
  - [x] Closest control accepts exposed static strings.
  - [x] Sink includes admin-only lineup, score, ladder, next-ref, and push-debug actions.
  - [x] No counterevidence showed stronger auth outside the passcode gates.
  - [x] Production override remains the only material proof gap.
- Evidence observed: `worker/index.ts:86-87` falls back to `adminadmin` / `upthegrimace`; `wrangler.jsonc:15-18` sets those values as Worker vars; `src/App.tsx:72-73` hardcodes them; `rg` confirmed both values appear in the built bundle at `dist/assets/index-CN0lbbAX.js:71`; `worker/index.ts:157-168` and `worker/index.ts:1681-1682` apply those passcode gates.
- Disposition: reportable.
- Remaining uncertainty: whether live Cloudflare secrets override the committed Wrangler vars. The built client still exposes both passcodes in the checked-out build.
- Minimal next step: remove client-side secret checks, remove passcode defaults, move production secrets to Cloudflare secrets, rotate the exposed passcodes, and replace shared passcode auth with per-user sessions for privileged actions.

### CAND-002: Public read APIs expose team data despite `VIEW_PASSCODE` support

- Instance key: `data-exposure:worker/index.ts:157`
- Ledger row: RW-002
- Confidence: medium-high
- Validation method: static route/control trace.
- Rubric:
  - [x] Attacker input is unauthenticated GET requests.
  - [x] `requireTeamPasscode()` intentionally returns `null` for non-write methods.
  - [x] Sinks return users, messages, events, availability, lineups, next-ref state/history, and stats.
  - [ ] Visitor mode may mean some public read access is intended.
  - [x] Proof gap is product intent for anonymous visitors versus passcode-protected viewers.
- Evidence observed: `worker/index.ts:157-158` bypasses passcode checks for non-write methods before all route handlers; GET routes at `worker/index.ts:1695`, `1812`, `1817`, `2051`, `2323`, `2411`, and `2547` return team data. `wrangler.jsonc:18` defines `VIEW_PASSCODE`, but no server-side GET enforcement uses it.
- Disposition: reportable as a privacy/access-control issue if visitor mode is not meant to expose these records to the Internet.
- Remaining uncertainty: the app has explicit visitor mode, so some read-only public exposure may be intentional. The unused `VIEW_PASSCODE` suggests the intended boundary is ambiguous.
- Minimal next step: decide the intended read boundary; if team data is private, require a view/team passcode or session for non-public GET routes and keep only explicitly public routes unauthenticated.

### CAND-003: Client-supplied `userId` permits same-passcode identity impersonation

- Instance key: `idor:worker/index.ts:2329`
- Ledger row: RW-002
- Confidence: high
- Validation method: static source-to-sink trace.
- Rubric:
  - [x] Attacker controls `userId` in JSON bodies or localStorage-derived frontend state.
  - [x] Closest control is only the shared team passcode plus comparisons to the same attacker-supplied `userId`.
  - [x] Protected actions include message creation/edit/delete/reaction, availability, notification preference, and next-ref pass/accept.
  - [x] No server-bound session, signed identity, or per-user credential was found.
  - [x] Preconditions are limited to possession of the shared team passcode.
- Evidence observed: frontend identity is localStorage (`src/utils/storage.ts:4-5`, `src/App.tsx:76`); API wrappers serialize `userId` (`src/services/dataService.ts:44-54`, `77-80`, `91-94`, `101-102`); server checks message ownership by comparing stored owner to body `userId` (`worker/index.ts:2384-2386`, `2400-2402`), accepts arbitrary author on post (`worker/index.ts:2329-2340`), accepts availability user IDs (`worker/index.ts:2552-2580`), notification preferences (`worker/index.ts:2584-2594`), and next-ref pass/accept if the caller supplies the current ref user ID (`worker/index.ts:1851-1860`, `1902-1910`).
- Disposition: reportable.
- Remaining uncertainty: none in the inspected code path; dynamic proof would require mutating a database.
- Minimal next step: bind writes to a server-issued per-user session/actor and ignore client-supplied owner IDs for self-service actions.

### CAND-004: Push subscription ownership can be hijacked by supplying another user's ID

- Instance key: `idor:worker/index.ts:2257`
- Ledger row: RW-002
- Confidence: high
- Validation method: static source-to-sink trace.
- Rubric:
  - [x] Attacker controls `userId` and subscription JSON in `/api/push/subscription`.
  - [x] Closest control checks only that the user exists.
  - [x] Sink stores attacker's endpoint under that user and notification dispatch selects subscriptions by recipient user id.
  - [x] No ownership proof binds the subscription endpoint to the authenticated user.
  - [x] Requires team passcode and browser-generated or valid-looking push keys.
- Evidence observed: `worker/index.ts:2257-2268` accepts `body.userId`, checks existence, and deletes same endpoint rows for other users; `worker/index.ts:2271-2297` inserts the endpoint for `body.userId`; notification dispatch queries subscriptions by recipient IDs and sends/stores payloads (`worker/index.ts:473-510`). Client code passes mutable `currentUserId` into push sync (`src/services/pushNotifications.ts:64`, `143-152`; `src/services/dataService.ts:58-71`).
- Disposition: reportable.
- Remaining uncertainty: dynamic proof requires a push-capable browser and live Worker/D1/VAPID setup.
- Minimal next step: require the authenticated actor to match the subscription `userId`, or derive user identity server-side; consider a per-user nonce during subscription registration.

### CAND-005: Push pending queue is unauthenticated and drains payloads by endpoint

- Instance key: `auth-missing:worker/index.ts:2092`
- Ledger row: RW-002
- Confidence: medium
- Validation method: static source-to-sink trace.
- Rubric:
  - [x] Attacker controls `endpoint` query parameter.
  - [x] Closest control is endpoint secrecy only.
  - [x] Sink returns pending payload JSON and deletes the queue row.
  - [x] No passcode/session/nonce is required on the route.
  - [ ] Exploitability requires endpoint disclosure or a companion subscription-hijack path.
- Evidence observed: service worker calls `/api/push/pending?endpoint=...` (`public/service-worker.js:14-18`); Worker route reads and deletes by endpoint without auth (`worker/index.ts:2092-2101`); queue stores endpoint/payload JSON (`migrations/master_seed.sql:100-104`).
- Disposition: reportable with endpoint-disclosure precondition; also amplifies CAND-004.
- Remaining uncertainty: endpoint secrecy in the real deployment.
- Minimal next step: bind pending dequeue to an authenticated user or add an unguessable per-subscription server nonce separate from the push endpoint.

### CAND-006: User-controlled push endpoint can drive Worker outbound fetches

- Instance key: `ssrf:worker/index.ts:256`
- Ledger row: RW-005
- Confidence: medium for arbitrary public egress, low for security-impact SSRF.
- Validation method: static trace.
- Rubric:
  - [x] Attacker with team passcode can submit endpoint-shaped strings.
  - [x] No push-service host allowlist exists.
  - [x] Worker can call `fetch(endpoint)` during notification dispatch.
  - [ ] Internal network or sensitive metadata access is not established for Cloudflare Worker egress.
  - [x] Requires VAPID config and notification trigger.
- Evidence observed: sanitizer validates endpoint presence and key shape only (`worker/index.ts:256-275`); VAPID JWT computes `new URL(endpoint).origin` (`worker/index.ts:327-330`); push ping posts to endpoint (`worker/index.ts:375-389`); endpoint is supplied through subscription route (`worker/index.ts:2257-2297`).
- Disposition: suppressed as a high-impact SSRF finding; retained as hardening/abuse note.
- Counterevidence/proof gap: no repository evidence that Cloudflare Worker egress reaches private network services or sensitive metadata, and the attacker already needs the team passcode. The proven impact is arbitrary public egress with VAPID headers, below the high-impact SSRF bar.
- Minimal next step: restrict subscription endpoints to known browser push service URL patterns if abuse prevention is desired.

### CAND-007: Static public data files expose team activity records

- Instance key: `data-exposure:public/data/users.json:2`
- Ledger row: RW-009
- Confidence: high for exposure, medium for sensitivity.
- Validation method: file placement plus built artifact confirmation.
- Rubric:
  - [x] Attacker can request static `/data/*.json` paths if deployed.
  - [x] Files are in Vite `public/` and copied to `dist/data`.
  - [x] Contents include roster, messages, availability, lineups, fines, and event data.
  - [ ] Whether contents are production-real versus demo/stale remains unclear.
  - [x] No auth gate protects static assets once served.
- Evidence observed: `Test-Path dist\data\users.json` and `dist\data\messages.json` returned true; `dist\data` contains all reviewed JSON files. Source files contain team records under `public/data/*`; Cloudflare serves `./dist` assets in `wrangler.jsonc:10-12`.
- Disposition: reportable if the data is real or production-adjacent; otherwise a cleanup/privacy hardening item.
- Remaining uncertainty: data freshness/sensitivity.
- Minimal next step: remove private JSON fixtures from `public/` or replace with sanitized demo data; treat production data as API-only behind the intended read boundary.

### CAND-008: Pull-request workflow can deploy PR-controlled code with Cloudflare secrets

- Instance key: `ci-deploy:.github/workflows/deploy-pages.yml:4`
- Ledger row: RW-008
- Confidence: medium-high
- Validation method: CI configuration trace.
- Rubric:
  - [x] Workflow triggers on `pull_request`.
  - [x] It checks out PR code and runs `npm ci`, lint, typecheck, build, then deploy.
  - [x] Deploy step receives Cloudflare secrets and runs `npm run cf:deploy`.
  - [x] GitHub fork-PR secret withholding is relevant counterevidence for forked PRs only.
  - [x] Same-repo PRs and protected-environment settings remain the key deployment precondition.
- Evidence observed: `.github/workflows/deploy-pages.yml:3-7` includes `pull_request`; line 13 checks out code; lines 18-22 run build and deploy; lines 23-25 inject Cloudflare secrets; `package.json:13` maps `cf:deploy` to `wrangler deploy`.
- Disposition: reportable for repositories where PR authors are not fully trusted to deploy production Workers.
- Remaining uncertainty: repository collaboration model, branch protection, and GitHub environment approvals.
- Minimal next step: remove deploy from `pull_request`; deploy only on protected `push` to `main` or require protected environments/manual approvals with least-privilege Cloudflare tokens.

### CAND-009: Seed schema can create weaker production constraints than runtime code assumes

- Instance key: `schema-integrity:migrations/master_seed.sql:1`
- Ledger row: RW-004
- Confidence: low-medium
- Validation method: schema comparison.
- Rubric:
  - [ ] Attacker input does not directly reach schema application.
  - [x] Operator/deploy path could initialize live D1 with weaker constraints.
  - [x] Runtime code assumes availability unique constraint for `ON CONFLICT(event_id,user_id)`.
  - [x] Runtime `CREATE TABLE IF NOT EXISTS` would not retrofit missing constraints into existing tables.
  - [ ] Actual live schema/deployment path is unknown.
- Evidence observed: `master_seed.sql:1` disables FKs and reset-drops tables; `master_seed.sql:107-147` creates `messages`, `lineups`, and `availability` with fewer constraints than runtime bootstrap at `worker/index.ts:579-652`; availability write relies on `ON CONFLICT(event_id,user_id)` (`worker/index.ts:2563-2565`).
- Disposition: deferred / configuration integrity risk, not a standalone exploitable vulnerability from repository evidence alone.
- Proof gap: whether `master_seed.sql` is applied to production or only used as a local reset seed.
- Minimal next step: inspect live D1 indexes/FKs and align seed schema with runtime migrations.

## Validation Closure Table

| Ledger row id | Instance key | Root-control file:line | Entrypoint/source | Sink/control | Disposition | Counterevidence or proof gap | Survives |
|---|---|---|---|---|---|---|---|
| RW-001 | `default-credential:worker/index.ts:85` | `worker/index.ts:85` | `x-team-passcode` header | `requireTeamPasscode` / `requireAdminPasscode` | reportable | Production override unknown, but source/config/bundle expose accepted strings. | yes |
| RW-003 | `default-credential:worker/index.ts:85` | `wrangler.jsonc:15` | Admin write routes | Admin passcode gate | reportable | Same as RW-001; admin routes rely on exposed secret. | yes |
| RW-002 | `data-exposure:worker/index.ts:157` | `worker/index.ts:157` | unauthenticated GET | public API data responses | reportable | Visitor-mode intent ambiguous; `VIEW_PASSCODE` unused. | yes |
| RW-002 | `idor:worker/index.ts:2329` | `worker/index.ts:2329` | body/localStorage `userId` | user-scoped writes | reportable | No per-user actor binding found. | yes |
| RW-002 | `idor:worker/index.ts:2257` | `worker/index.ts:2257` | subscription `userId` | push subscription storage/dispatch | reportable | Requires valid team passcode/push setup. | yes |
| RW-002 | `auth-missing:worker/index.ts:2092` | `worker/index.ts:2092` | query `endpoint` | pending payload read/delete | reportable | Requires endpoint knowledge or companion path. | yes |
| RW-005 | `ssrf:worker/index.ts:256` | `worker/index.ts:256` | subscription endpoint | `fetch(endpoint)` | suppressed | Public egress proven; private-network/metadata impact not established. | no |
| RW-006 | `xss:src/pages/ChatPage.tsx:106` | `src/pages/ChatPage.tsx:106` | chat/name text | React rendering | suppressed | No raw HTML sinks; React text interpolation escapes. | no |
| RW-007 | `sw-nav:public/service-worker.js:40` | `public/service-worker.js:40` | push payload URL | notification click navigation | suppressed | Server-created payload URL is fixed to `/chat`; no arbitrary URL store route found. | no |
| RW-008 | `ci-deploy:.github/workflows/deploy-pages.yml:4` | `.github/workflows/deploy-pages.yml:4` | PR-controlled workflow code | `npm run cf:deploy` with Cloudflare secrets | reportable | Fork PR secret withholding only partially mitigates; same-repo PRs remain. | yes |
| RW-009 | `data-exposure:public/data/users.json:2` | `public/data/users.json:2` | static asset request | `dist/data/*.json` | reportable | Sensitivity depends on whether data is real/stale/demo. | yes |
| RW-004 | `schema-integrity:migrations/master_seed.sql:1` | `migrations/master_seed.sql:1` | operator-applied seed schema | D1 table constraints | deferred | Live schema/deployment path unknown; no direct attacker path. | uncertain |
