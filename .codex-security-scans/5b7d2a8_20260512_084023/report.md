# GrimaceFC Repository Security Scan Report

Scan target: `C:\Users\plain\Github\GrimaceFC`

Commit: `5b7d2a8`

Scan artifacts: `.codex-security-scans/5b7d2a8_20260512_084023/artifacts`

## Finding: Hardcoded passcodes grant write and admin access

- Priority: P1
- Severity: high
- Confidence: high
- CWE: CWE-798 Use of Hard-coded Credentials; CWE-1392 Use of Default Credentials
- Affected lines: `worker/index.ts:85-88`, `wrangler.jsonc:15-18`, `src/App.tsx:72-73`, `worker/index.ts:157-168`, `worker/index.ts:1681-1682`

### Summary

The app's team/admin authorization depends on static passcodes that are committed in Worker config, used as Worker fallbacks, and embedded in the frontend. The built bundle also contains `adminadmin` and `upthegrimace`, so anyone who can load or inspect the client can recover credentials for protected API calls.

### Validation

Validated by static trace and built-bundle search. `resolvePasscodeRole()` accepts the literals, `wrangler.jsonc` defines them as vars, `src/App.tsx` hardcodes them, and `rg` found them in `dist/assets/index-CN0lbbAX.js`. Runtime testing against production was not attempted to avoid mutating live data.

### Reachability Analysis

The affected Worker API is an in-scope public product surface. The passcode is supplied via `x-team-passcode` and gates all write/admin routes. Production override with real Cloudflare secrets would reduce server-side exposure, but the frontend still ships the same literals in the checked-out build.

### Attack Path

1. Attacker loads or inspects the client bundle and recovers `adminadmin` / `upthegrimace`.
2. Attacker sends API requests with `x-team-passcode` set to the recovered value.
3. Worker maps the value to `admin` or `view`.
4. Admin-only and team-write routes accept the request.

### Severity Analysis

Impact is high because admin state, scores, lineups, ref workflow, messages, users, and push debug data can be modified or read. Likelihood is high if deployed values match the repo/bundle values. Final severity: high.

### Remediation

Remove passcode literals from client code and source-controlled Wrangler vars, remove server defaults, rotate exposed passcodes, and use Cloudflare secrets plus server-issued per-user sessions or tokens. Add a regression check that fails builds if known passcode literals appear in `dist`.

## Finding: Client-supplied user IDs permit identity impersonation

- Priority: P1
- Severity: high
- Confidence: high
- CWE: CWE-639 Authorization Bypass Through User-Controlled Key; CWE-862 Missing Authorization
- Affected lines: `src/utils/storage.ts:4-5`, `src/App.tsx:76`, `src/services/dataService.ts:44-54`, `src/services/dataService.ts:77-80`, `src/services/dataService.ts:91-94`, `src/services/dataService.ts:101-102`, `worker/index.ts:1851-1860`, `worker/index.ts:1902-1910`, `worker/index.ts:2329-2340`, `worker/index.ts:2352-2405`, `worker/index.ts:2552-2594`

### Summary

User identity is a mutable client value. The Worker accepts `userId` from request bodies for chat, reactions, attendance, notification preferences, and next-ref decisions, and owner checks compare rows to the attacker-supplied `userId` rather than to a server-authenticated actor.

### Validation

Validated by static trace from localStorage identity through API wrappers to Worker route handlers. No server-bound session, signed identity, or per-user credential was found in the inspected paths.

### Reachability Analysis

A regular team-passcode holder can send direct HTTP requests and choose another user's ID. This crosses a meaningful user identity boundary even though the app is single-team rather than multi-tenant.

### Attack Path

1. Attacker with the shared team passcode learns a victim `userId` from public API data or local app data.
2. Attacker sends writes with the victim `userId`.
3. Worker treats that body field as the actor.
4. Attacker posts/edits/deletes as the victim, changes attendance/preferences, or accepts/passes ref duty as the current ref.

### Severity Analysis

Impact is high for app integrity and identity because a regular passcode holder can operate as another user. Likelihood is high given the shared passcode model. Final severity: high.

### Remediation

Introduce server-issued user sessions and derive actor identity server-side. For self-service routes, ignore body `userId` except as a target field explicitly authorized by the authenticated actor. Add tests that direct requests with mismatched actor/target IDs are rejected.

## Finding: Pull requests can run deployment with Cloudflare secrets

- Priority: P2
- Severity: medium
- Confidence: medium-high
- CWE: CWE-829 Inclusion of Functionality from Untrusted Control Sphere
- Affected lines: `.github/workflows/deploy-pages.yml:3-7`, `.github/workflows/deploy-pages.yml:13`, `.github/workflows/deploy-pages.yml:22-25`, `package.json:13`

### Summary

The deploy workflow runs on `pull_request`, checks out PR code, then runs `npm run cf:deploy` with Cloudflare secrets. Fork PRs normally do not receive repository secrets, but same-repository PRs or approved/misconfigured PR workflows can execute PR-controlled build/deploy code before merge.

### Validation

Validated by workflow trace. The workflow includes `pull_request`, checks out code, runs install/build commands, and passes `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` to the deploy step.

### Reachability Analysis

This is a production workflow boundary, not a public HTTP boundary. It matters when PR authors are not all trusted to deploy production Worker code or access Cloudflare deployment credentials.

### Attack Path

1. Same-repo PR author changes `package.json`, build scripts, or deploy-time code.
2. Pull request workflow checks out and runs that code.
3. Deploy step receives Cloudflare credentials.
4. PR-controlled code deploys changes or exfiltrates secrets.

### Severity Analysis

Impact is high for deployment integrity, but likelihood is medium because fork secret withholding and repo permissions may limit attacker positions. Final severity: medium.

### Remediation

Remove deploy from `pull_request`. Deploy only on protected `push` to `main`, or require protected GitHub environments/manual approval. Use least-privilege Cloudflare tokens and avoid exposing deploy credentials to PR-controlled steps.

## Finding: Public read APIs expose team data despite configured view passcode

- Priority: P2
- Severity: medium
- Confidence: medium-high
- CWE: CWE-306 Missing Authentication for Critical Function; CWE-200 Exposure of Sensitive Information
- Affected lines: `worker/index.ts:157-158`, `worker/index.ts:1681-1682`, `worker/index.ts:1695`, `worker/index.ts:1812`, `worker/index.ts:1817`, `worker/index.ts:2051`, `worker/index.ts:2323`, `worker/index.ts:2411`, `worker/index.ts:2547`

### Summary

`requireTeamPasscode()` returns no error for non-write methods, so GET APIs are public. Those routes return users, messages, events, availability, lineups, next-ref state/history, and stats. `VIEW_PASSCODE` is configured but not enforced server-side.

### Validation

Validated by static route/control trace. Product visitor mode may intentionally allow read-only access, so the final impact depends on whether anonymous internet users should see team data.

### Reachability Analysis

The Worker API is remote and public. No server-side read authorization was found. Visitor mode is counterevidence that some read exposure may be intended, but it does not explain the unused `VIEW_PASSCODE` boundary.

### Attack Path

1. Remote caller requests read endpoints without `x-team-passcode`.
2. Passcode guard bypasses non-write methods.
3. API returns team data.

### Severity Analysis

Impact is medium if this data is private team information; likelihood is high because the routes are unauthenticated. Final severity: medium.

### Remediation

Define the intended public/read boundary. If data is private, require a view/team passcode or session for private GET routes and keep only explicitly public data unauthenticated.

## Finding: Push subscriptions can be registered for another user

- Priority: P2
- Severity: medium
- Confidence: high
- CWE: CWE-639 Authorization Bypass Through User-Controlled Key
- Affected lines: `src/services/pushNotifications.ts:64`, `src/services/pushNotifications.ts:143-152`, `src/services/dataService.ts:58-71`, `worker/index.ts:2257-2268`, `worker/index.ts:2271-2297`, `worker/index.ts:473-510`

### Summary

`POST /api/push/subscription` validates that `body.userId` exists, then stores the caller-provided endpoint for that user. It does not prove the caller is that user. A same-passcode attacker can bind their own push endpoint to a victim and receive notification previews intended for the victim.

### Validation

Validated by source-to-sink trace. Dynamic proof would require a push-capable browser, live Worker/D1, and VAPID configuration.

### Reachability Analysis

This is reachable by any team-passcode holder. It crosses a notification privacy boundary from victim user to attacker-controlled browser endpoint.

### Attack Path

1. Attacker creates a browser push subscription they control.
2. Attacker submits it with a victim `userId`.
3. Worker stores the endpoint under the victim.
4. Future victim-targeted notifications are delivered or queued to the attacker endpoint.

### Severity Analysis

Impact is medium because chat notification previews can be disclosed and preferences/subscriptions tampered with. Likelihood is high for passcode holders. Final severity: medium.

### Remediation

Bind subscription registration to the authenticated server-side actor. Consider a per-user, server-issued subscription registration nonce and reject subscriptions where actor and target user differ.

## Finding: Static public data files expose team activity records

- Priority: P2
- Severity: medium
- Confidence: medium
- CWE: CWE-200 Exposure of Sensitive Information
- Affected lines: `public/data/users.json:2`, `public/data/messages.json:2`, `public/data/availability.json:2`, `public/data/lineups.json:3`, `public/data/fines.json:2`, `public/data/events.json:2`, `wrangler.jsonc:10-12`

### Summary

Team data files are under Vite `public/data` and are present in `dist/data`, which Cloudflare serves as static assets. If these are real or production-adjacent records, anyone can fetch roster, message, availability, lineup, fines, and event data directly from `/data/*.json`.

### Validation

Validated locally: `dist/data` contains the JSON files. The content sensitivity is the main uncertainty.

### Reachability Analysis

Static assets are public by design. This bypasses any API-level read boundary because the files are shipped as assets.

### Attack Path

1. Remote caller requests `/data/users.json` or another `/data/*.json` path.
2. Cloudflare asset serving returns the file from `dist/data`.
3. Caller reads team records if the files are deployed.

### Severity Analysis

Impact is medium if the records are real; lower if they are sanitized fixtures. Likelihood is high for deployed static files. Final severity: medium.

### Remediation

Remove private data from `public/`, replace with sanitized fixtures, or serve it only through authorized API routes. Add build checks that prevent sensitive fixture paths from being copied into production assets.

## Finding: Pending push notifications can be read and drained by endpoint

- Priority: P3
- Severity: low
- Confidence: medium
- CWE: CWE-306 Missing Authentication for Critical Function
- Affected lines: `public/service-worker.js:14-18`, `worker/index.ts:2092-2101`, `migrations/master_seed.sql:100-104`

### Summary

`GET /api/push/pending` uses the push endpoint as a bearer key. Anyone who knows an endpoint can fetch the queued notification payload and delete it, causing both disclosure and notification loss.

### Validation

Validated by static trace. The route requires only `endpoint`, reads `payload_json`, deletes the queue row, and returns the notification.

### Reachability Analysis

The route is public, but standalone exploitation depends on endpoint disclosure. Endpoint secrecy reduces likelihood; the push subscription hijack finding provides a companion path where attacker-controlled endpoints can receive victim notifications.

### Attack Path

1. Attacker obtains a victim endpoint.
2. Attacker requests `/api/push/pending?endpoint=<endpoint>`.
3. Worker returns queued notification data and deletes it.

### Severity Analysis

Impact is medium but likelihood is constrained by endpoint secrecy, so final standalone severity is low.

### Remediation

Authenticate pending reads or add a server-issued nonce per subscription. Avoid using the push endpoint itself as the only authorization secret.

## Coverage Closure

- `ssrf:worker/index.ts:256` suppressed: arbitrary public egress through push endpoint is possible, but repository evidence does not establish private-network or sensitive metadata reachability in Cloudflare Workers.
- `xss:src/pages/ChatPage.tsx:106` suppressed: dynamic text is rendered through React text/spans, and no raw HTML sinks were found.
- `sw-nav:public/service-worker.js:40` suppressed: notification payload URLs are server-created as `/chat`, with no arbitrary URL storage route found.
- `schema-integrity:migrations/master_seed.sql:1` deferred: seed/runtime schema mismatch may matter if `master_seed.sql` initializes production D1, but live schema and deployment use are unknown.

## Follow Up Prompts

- Fix auth in `worker/index.ts` by replacing shared passcodes with server-issued sessions and enforcing actor identity for message, availability, notification, and next-ref routes.
- Lock down `.github/workflows/deploy-pages.yml` so Cloudflare deploy only runs from protected `main`, then review token scope and environment approvals.
- Remove `public/data/*.json` from production assets or prove each file is sanitized demo data before deploying.
