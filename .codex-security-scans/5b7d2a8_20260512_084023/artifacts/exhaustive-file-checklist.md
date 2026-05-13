# Exhaustive File Checklist

- [x] `.github/workflows/deploy-pages.yml`
- [x] `package.json`
- [x] `wrangler.jsonc`
- [x] `worker/index.ts`
- [x] `worker/cloudflare.d.ts`
- [x] `src/main.tsx`
- [x] `src/App.tsx`
- [x] `src/components/BottomNav.tsx`
- [x] `src/components/NameGate.tsx`
- [x] `src/constants/formation.ts`
- [x] `src/pages/ChatPage.tsx`
- [x] `src/pages/NextGamePage.tsx`
- [x] `src/pages/NextRefPage.tsx`
- [x] `src/pages/TeamStatsPage.tsx`
- [x] `src/pages/UpcomingGamesPage.tsx`
- [x] `src/services/dataService.ts`
- [x] `src/services/pushNotifications.ts`
- [x] `src/types/models.ts`
- [x] `src/utils/date.ts`
- [x] `src/utils/events.ts`
- [x] `src/utils/storage.ts`
- [x] `src/styles.css`
- [x] `public/service-worker.js`
- [x] `public/manifest.webmanifest`
- [x] `public/data/availability.json`
- [x] `public/data/events.json`
- [x] `public/data/fines.json`
- [x] `public/data/lineups.json`
- [x] `public/data/messages.json`
- [x] `public/data/nicknames.json`
- [x] `public/data/users.json`
- [x] `migrations/master_seed.sql`
- [x] `migrations/0003_chat_reactions_and_message_edits.sql`
- [x] `migrations/0004_season_ladder_current.sql`
- [x] `migrations/0005_rev_messages.sql`

Initial annotations:

- High-risk hits: `worker/index.ts` contains passcode checks, all API routes, D1 queries, push network fetches, and object update controls.
- High-risk hits: `wrangler.jsonc` and `src/App.tsx` contain hardcoded passcode literals.
- High-risk hits: `src/services/dataService.ts` shows writes authenticate only with a shared passcode header.
- XSS sink search found no `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, or `insertAdjacentHTML` in `src/` or `public/service-worker.js`.
- SQL search found widespread D1 prepared statements; dynamic SQL in `worker/index.ts` appears derived from fixed/introspected column lists rather than raw request strings.
