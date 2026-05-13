# Finding Discovery Report

Scope: repository-wide scan of `GrimaceFC` at commit `5b7d2a8`.

Inputs: `runtime_inventory.md`, `threat_model.md`, `seed_research.md`, `exhaustive-file-checklist.md`, and subagent file-pass results.

## File-Pass Completion

All in-scope files listed in `exhaustive-file-checklist.md` were fully read by the main agent or subagents. The checklist was updated to checked state after all file-pass confirmations were received.

## Candidate Findings

### CAND-001: Hardcoded/default passcodes grant write and admin access

- Instance key: `default-credential:worker/index.ts:85`
- Ledger rows: RW-001, RW-003
- Affected locations:
  - root_control: `worker/index.ts:85-88`
  - deployment_config: `wrangler.jsonc:15-18`
  - client_bundle_source: `src/App.tsx:72-73`
  - client_bundle_built: `dist/assets/index-CN0lbbAX.js:71`
  - write/admin gate: `worker/index.ts:157-168`, `worker/index.ts:1681-1682`
- Attacker-controlled source: `x-team-passcode` request header.
- Broken control: write/admin authorization accepts static shared strings that are committed in source/config and present in the built client bundle.
- Impact: unauthenticated Internet users who inspect the client bundle or repository can perform team writes and admin-only actions when deployed values match the repo values.
- Closest apparent control: `requireTeamPasscode()` / `requireAdminPasscode()`; incomplete because the accepted secrets are static and exposed.
- Taxonomy: CWE-798, CWE-1392, CWE-522.
- Validation recommended: yes.

### CAND-002: Public read APIs expose team data despite `VIEW_PASSCODE` support

- Instance key: `data-exposure:worker/index.ts:157`
- Ledger row: RW-002
- Affected locations:
  - root_control: `worker/index.ts:157-158`, `worker/index.ts:1681-1682`
  - exposed read routes: `worker/index.ts:1695`, `worker/index.ts:1812`, `worker/index.ts:1817`, `worker/index.ts:2051`, `worker/index.ts:2323`, `worker/index.ts:2411`, `worker/index.ts:2547`
- Attacker-controlled source: unauthenticated GET requests.
- Broken control: `requireTeamPasscode()` explicitly returns no error for non-write methods, so `VIEW_PASSCODE` is not enforced on GET routes.
- Impact: unauthenticated access to events, users, chat messages, lineups, availability, next-ref state/history, and stats.
- Closest apparent control: visitor mode and no-store cache headers; these do not enforce server-side read authorization.
- Taxonomy: CWE-306, CWE-862, CWE-200.
- Validation recommended: yes.

### CAND-003: Client-supplied `userId` permits same-passcode identity impersonation

- Instance key: `idor:worker/index.ts:2329`
- Ledger row: RW-002
- Affected locations:
  - identity source: `src/utils/storage.ts:4-5`, `src/App.tsx:76`, `src/App.tsx:505`
  - message create/edit/delete/reaction: `worker/index.ts:2329-2340`, `worker/index.ts:2352-2374`, `worker/index.ts:2377-2405`
  - availability: `worker/index.ts:2552-2580`
  - notification preference: `worker/index.ts:2584-2594`
  - next-ref pass/accept: `worker/index.ts:1851-1860`, `worker/index.ts:1902-1910`
  - client wrappers: `src/services/dataService.ts:44-54`, `src/services/dataService.ts:77-80`, `src/services/dataService.ts:91-94`, `src/services/dataService.ts:101-102`
- Attacker-controlled source: JSON body `userId`, route IDs, and browser localStorage identity.
- Broken control: server-side owner checks compare protected rows to caller-supplied `userId` without binding the caller to that user.
- Impact: a valid passcode holder can act as another user for chat, attendance, notification preferences, and ref-duty decisions.
- Closest apparent control: team passcode blocks unauthenticated writes; incomplete for per-user ownership.
- Taxonomy: CWE-639, CWE-862.
- Validation recommended: yes.

### CAND-004: Push subscription ownership can be hijacked by supplying another user's ID

- Instance key: `idor:worker/index.ts:2257`
- Ledger row: RW-002
- Affected locations:
  - client source: `src/services/pushNotifications.ts:64`, `src/services/pushNotifications.ts:143-152`, `src/services/dataService.ts:58-71`
  - root_control: `worker/index.ts:2257-2268`, `worker/index.ts:2271-2297`
  - delivery sink: `worker/index.ts:473-510`
- Attacker-controlled source: `POST /api/push/subscription` JSON `userId` and subscription object.
- Broken control: route validates only that `body.userId` exists in `users`, then stores the caller-provided endpoint under that user.
- Impact: same-passcode user can attach their own endpoint to a victim user and receive notification previews intended for that victim.
- Closest apparent control: valid team passcode and existing user check; incomplete for subscription/user ownership.
- Taxonomy: CWE-639, CWE-284.
- Validation recommended: yes.

### CAND-005: Push pending queue is unauthenticated and drains payloads by endpoint

- Instance key: `auth-missing:worker/index.ts:2092`
- Ledger row: RW-002
- Affected locations:
  - client request: `public/service-worker.js:14-18`
  - root_control: `worker/index.ts:2092-2101`
  - schema: `migrations/master_seed.sql:100-104`
- Attacker-controlled source: GET query parameter `endpoint`.
- Broken control: queued payload lookup and deletion require only endpoint equality, with no passcode/session/user proof.
- Impact: if an endpoint is known or leaked, a caller can read the pending notification and suppress delivery by deleting the queue row.
- Closest apparent control: endpoint entropy; no ownership proof or nonce.
- Taxonomy: CWE-306, CWE-284.
- Validation recommended: yes.

### CAND-006: User-controlled push endpoint can drive Worker outbound fetches

- Instance key: `ssrf:worker/index.ts:256`
- Ledger row: RW-005
- Affected locations:
  - sanitizer: `worker/index.ts:256-275`
  - sink: `worker/index.ts:375-389`
  - subscription write: `worker/index.ts:2257-2297`
- Attacker-controlled source: subscription endpoint in `POST /api/push/subscription`.
- Broken control: subscription shape is validated, but endpoint scheme/host/service provider is not allowlisted before `fetch(endpoint)`.
- Impact: same-passcode user may cause Worker egress to attacker-chosen URLs when push notifications are sent; internal-network impact is not proven.
- Closest apparent control: requires passcode and valid-looking push keys; Cloudflare Worker egress context limits traditional metadata/VPC SSRF assumptions.
- Taxonomy: CWE-918.
- Validation recommended: yes.

### CAND-007: Static public data files expose team activity records

- Instance key: `data-exposure:public/data/users.json:2`
- Ledger row: RW-009
- Affected locations: `public/data/users.json:2`, `public/data/messages.json:2`, `public/data/availability.json:2`, `public/data/lineups.json:3`, `public/data/fines.json:2`, `public/data/events.json:2`, built `dist/data/*`.
- Attacker-controlled source: unauthenticated HTTP requests for `/data/*.json`.
- Broken control: files are placed in Vite `public/` and copied to `dist/` for static serving.
- Impact: public exposure of roster, chat snippets, availability, lineup, fines, and schedule metadata if these are real production-adjacent records.
- Closest apparent control: none on static assets; impact depends on whether data is real/demo.
- Taxonomy: CWE-200.
- Validation recommended: yes.

### CAND-008: Pull-request workflow can deploy PR-controlled code with Cloudflare secrets

- Instance key: `ci-deploy:.github/workflows/deploy-pages.yml:4`
- Ledger row: RW-008
- Affected locations: `.github/workflows/deploy-pages.yml:3-7`, `.github/workflows/deploy-pages.yml:13`, `.github/workflows/deploy-pages.yml:22-25`, `package.json:13`.
- Attacker-controlled source: pull request changes to build/deploy-time code or package scripts.
- Broken control: workflow triggers on `pull_request` and runs `npm run cf:deploy` with Cloudflare secrets.
- Impact: same-repository PR authors, or untrusted PRs if secrets are exposed through approval/misconfiguration, can deploy or exfiltrate Cloudflare credentials before merge.
- Closest apparent control: GitHub withholds repository secrets from fork PRs by default; does not defeat same-repo PRs or protected-environment gaps.
- Taxonomy: CWE-829 / CI trust boundary.
- Validation recommended: yes.

### CAND-009: Seed schema can create weaker production constraints than runtime code assumes

- Instance key: `schema-integrity:migrations/master_seed.sql:1`
- Ledger row: RW-004
- Affected locations: `migrations/master_seed.sql:1`, `migrations/master_seed.sql:107-114`, `migrations/master_seed.sql:127-147`, runtime expected constraints at `worker/index.ts:579-652` and `worker/index.ts:2563-2565`.
- Attacker-controlled source: not directly attacker-controlled; operator/deploy path applies schema.
- Broken control: reset seed schema omits some FKs/unique constraints present in runtime bootstrap; `CREATE TABLE IF NOT EXISTS` will not retrofit constraints if weaker tables already exist.
- Impact: potential integrity gaps or availability write failures in deployed D1 if `master_seed.sql` initializes production schema.
- Closest apparent control: runtime `ensureSchema` creates stronger constraints only for new tables.
- Taxonomy: CWE-345 / configuration-integrity.
- Validation recommended: yes.
