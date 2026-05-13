# Attack Path Analysis Report

## Surviving Findings

### CAND-001 / RW-001,RW-003: Hardcoded/default passcodes grant write and admin access

Affected lines: `worker/index.ts:85-88`, `wrangler.jsonc:15-18`, `src/App.tsx:72-73`, `worker/index.ts:157-168`, `worker/index.ts:1681-1682`.

Attack path:
1. Remote attacker loads or inspects the shipped client bundle and recovers `adminadmin` / `upthegrimace`.
2. Attacker sends API write requests with `x-team-passcode` set to the recovered value.
3. Worker maps the value to `admin` or `view` in `resolvePasscodeRole()`.
4. Admin-only routes such as lineup, scores, next-ref admin, ladder refresh, and push debug accept the request.

Attack path facts:
- Assumptions: deployed Worker uses repo-configured vars or fallback values; built bundle is publicly served.
- In scope: yes, public Worker API and browser client are primary product surfaces.
- Exposure/vector: remote HTTP.
- Auth scope: effectively public when passcodes are embedded in served source.
- Impact surface: runtime data integrity and admin-only state.
- Mitigations present: passcode gates exist, but the accepted secrets are exposed.
- Counterevidence: production Cloudflare secrets could override committed vars, but the client bundle still contains the same passcodes in the checked-out build.
- Confidence: high.

Severity: high. Impact is high and likelihood is high because the secret is in source/config/built assets. Final policy decision: reportable, P1.

### CAND-003 / RW-002: Client-supplied user IDs permit same-passcode identity impersonation

Affected lines: `src/utils/storage.ts:4-5`, `src/App.tsx:76`, `src/services/dataService.ts:44-54`, `worker/index.ts:2329-2340`, `worker/index.ts:2352-2374`, `worker/index.ts:2377-2405`, `worker/index.ts:2552-2580`, `worker/index.ts:2584-2594`, `worker/index.ts:1851-1860`, `worker/index.ts:1902-1910`.

Attack path:
1. Team-passcode holder reads public user/message/ref state or local app data to learn a victim `userId`.
2. Attacker changes localStorage or sends direct API requests with the victim `userId`.
3. Worker uses the body `userId` as the actor for message, attendance, notification preference, and next-ref operations.
4. Owner checks compare database rows to the same attacker-supplied `userId`, so spoofed operations succeed.

Attack path facts:
- Assumptions: attacker has the shared team passcode; no separate per-user auth exists in inspected code.
- In scope: yes, self-service team writes and ref workflow are primary app surfaces.
- Exposure/vector: remote HTTP for any passcode holder.
- Auth scope: regular team passcode, not admin.
- Cross-boundary behavior: crosses from one team user's identity to another user's user-scoped state.
- Impact surface: data integrity, identity, notification settings, ref-duty state.
- Mitigations present: shared passcode blocks anonymous writes; no per-user session binding found.
- Counterevidence: small-team shared trust model lowers blast radius, but does not defeat the ownership bypass.
- Confidence: high.

Severity: high. Impact is high for user-scoped integrity/identity within the app and likelihood is high for any passcode holder. Final policy decision: reportable, P1.

### CAND-008 / RW-008: Pull-request workflow can deploy PR-controlled code with Cloudflare secrets

Affected lines: `.github/workflows/deploy-pages.yml:3-7`, `.github/workflows/deploy-pages.yml:13`, `.github/workflows/deploy-pages.yml:22-25`, `package.json:13`.

Attack path:
1. A same-repository PR author modifies build/deploy-time code or package scripts.
2. The `pull_request` workflow checks out that PR code and runs install/build steps.
3. The workflow runs `npm run cf:deploy` with Cloudflare API token/account secrets.
4. PR-controlled code can deploy Worker changes or exfiltrate CI-provided deployment credentials, depending on GitHub/Cloudflare controls.

Attack path facts:
- Assumptions: same-repo PR authors are not all trusted to deploy production; no protected environment blocks the deploy step.
- In scope: yes, deployment workflow is a meaningful production workflow.
- Exposure/vector: repository PR workflow, not public internet.
- Auth scope: same-repo PR contributor or any PR context where secrets are approved/exposed.
- Impact surface: build/deploy control plane and production Worker integrity.
- Mitigations present: GitHub does not expose secrets to fork PRs by default.
- Counterevidence: fork PR secret withholding reduces public attacker likelihood; same-repo PRs remain a realistic trust-boundary issue.
- Confidence: medium-high.

Severity: medium. Impact is high, likelihood is medium because exploitation depends on repository collaboration/protection settings. Final policy decision: reportable, P2.

### CAND-002 / RW-002: Public read APIs expose team data despite `VIEW_PASSCODE` support

Affected lines: `worker/index.ts:157-158`, `worker/index.ts:1681-1682`, read routes at `worker/index.ts:1695`, `worker/index.ts:1812`, `worker/index.ts:1817`, `worker/index.ts:2051`, `worker/index.ts:2323`, `worker/index.ts:2411`, `worker/index.ts:2547`.

Attack path:
1. Remote caller sends GET requests to read API endpoints with no passcode.
2. `requireTeamPasscode()` returns no error for non-write methods.
3. Routes return users, messages, events, lineups, availability, next-ref state/history, and stats.

Attack path facts:
- Assumptions: team data is intended to be private or view-passcode protected.
- In scope: yes, API read endpoints are primary product surfaces.
- Exposure/vector: remote HTTP.
- Auth scope: public for reads.
- Impact surface: data confidentiality and privacy.
- Mitigations present: visitor mode suggests some read-only access is intentional; no-store cache headers reduce caching only.
- Counterevidence: visitor mode may intentionally expose read data; `VIEW_PASSCODE` being configured but unused creates ambiguity.
- Confidence: medium-high.

Severity: medium if private team data should be protected; otherwise product-intent hardening. Final policy decision: reportable, P2.

### CAND-004 / RW-002: Push subscription ownership can be hijacked by supplying another user's ID

Affected lines: `src/services/pushNotifications.ts:64`, `src/services/pushNotifications.ts:143-152`, `src/services/dataService.ts:58-71`, `worker/index.ts:2257-2268`, `worker/index.ts:2271-2297`, `worker/index.ts:473-510`.

Attack path:
1. Team-passcode holder creates a browser push subscription under their own control.
2. Attacker submits it to `/api/push/subscription` with a victim `userId`.
3. Worker stores that endpoint for the victim user after only checking that the user exists.
4. Later chat notifications selected for the victim are sent or queued to the attacker's endpoint.

Attack path facts:
- Assumptions: attacker can obtain a valid push subscription and team passcode.
- In scope: yes, push notifications carry team chat previews across browser/service-provider boundaries.
- Exposure/vector: remote HTTP with team passcode.
- Auth scope: regular team passcode.
- Cross-boundary behavior: victim notification stream crosses to attacker-controlled endpoint.
- Impact surface: notification confidentiality and user preference integrity.
- Mitigations present: user existence check and shared passcode; no actor/user binding.
- Counterevidence: requires push setup and passcode; preview length limits reduce data volume.
- Confidence: high.

Severity: medium. Impact is medium, likelihood is high for passcode holders. Final policy decision: reportable, P2.

### CAND-007 / RW-009: Static public data files expose team activity records

Affected lines: `public/data/users.json:2`, `public/data/messages.json:2`, `public/data/availability.json:2`, `public/data/lineups.json:3`, `public/data/fines.json:2`, `public/data/events.json:2`, `wrangler.jsonc:10-12`.

Attack path:
1. Remote caller requests `/data/users.json`, `/data/messages.json`, or another static data file.
2. Vite copies files from `public/data` into `dist/data`.
3. Cloudflare assets serve `./dist` without Worker API authorization.
4. Caller reads roster, messages, attendance, lineup, fines, and schedule data if those files are deployed.

Attack path facts:
- Assumptions: data is real, sensitive, or production-adjacent rather than harmless demo fixtures.
- In scope: yes, static assets are part of the deployed product.
- Exposure/vector: remote static HTTP.
- Auth scope: public.
- Impact surface: data confidentiality/privacy.
- Mitigations present: none for static assets; sensitivity unknown.
- Counterevidence: files may be stale/demo data and not authoritative production records.
- Confidence: high for exposure, medium for sensitivity.

Severity: medium if records are real; otherwise low cleanup. Final policy decision: reportable, P2.

### CAND-005 / RW-002: Push pending queue is unauthenticated and drains payloads by endpoint

Affected lines: `public/service-worker.js:14-18`, `worker/index.ts:2092-2101`, `migrations/master_seed.sql:100-104`.

Attack path:
1. Attacker obtains or guesses a victim push endpoint, or first uses another bug to register/learn an endpoint.
2. Attacker requests `/api/push/pending?endpoint=<endpoint>` with no passcode.
3. Worker returns queued notification JSON and deletes the queue row.
4. Attacker reads the pending notification body and suppresses delivery.

Attack path facts:
- Assumptions: endpoint leaks or is obtained through a companion path such as push subscription hijack.
- In scope: yes, Worker pending queue and service worker are runtime surfaces.
- Exposure/vector: remote HTTP.
- Auth scope: public route with bearer-like endpoint secret.
- Impact surface: notification confidentiality and availability.
- Mitigations present: endpoint values are high entropy and not deliberately listed to normal users.
- Counterevidence: endpoint secrecy makes standalone exploitation lower likelihood.
- Confidence: medium.

Severity: low standalone. Impact is medium but likelihood is medium/low because endpoint knowledge is required. Final policy decision: reportable, P3.

## Suppressed Or Deferred Rows

- `ssrf:worker/index.ts:256`: suppressed as high-impact SSRF. The code can make Worker public egress to a submitted endpoint, but repository evidence does not show private-network or sensitive metadata reachability in Cloudflare Workers.
- `xss:src/pages/ChatPage.tsx:106`: suppressed. No raw HTML sinks were found; React text rendering escapes chat/names.
- `sw-nav:public/service-worker.js:40`: suppressed. Notification URLs are server-created as `/chat`; no arbitrary URL storage route was found.
- `schema-integrity:migrations/master_seed.sql:1`: deferred. Seed/runtime schema mismatch may matter if `master_seed.sql` initializes production D1, but this is an operator/deployment proof gap rather than a direct attacker path.
