# Grimace FC (GitHub Pages Static Team Hub)

A production-ready, mobile-first React + Vite website for a social soccer team, designed for **GitHub Pages-only** hosting with **no backend server**.

## Why shared anonymous repo writes are not safe on GitHub Pages

GitHub Pages serves static files only. Browsers cannot safely write directly to repository JSON without a credential. Exposing a token client-side would allow anyone to abuse repo write access. Therefore this project uses a two-layer model:

1. **Static Demo Mode (always on):** seed data is read from `/public/data/*.json`; user actions persist in `localStorage`.
2. **Maintainer Sync Mode (optional):** maintainers export local change bundles and merge them into repo JSON using a local Node script (`scripts/merge-local-changes.mjs`) and commit via Git.

This is the safest practical repo-only pattern while remaining fully deployable on GitHub Pages.

---

## Features

- Name gate on first load; returning users auto-skip to Chat.
- Mobile bottom navigation (hidden until user recognized).
- Upcoming events grouped by month, sorted, with next-up highlight.
- Fines list + modal submission + mobile filters.
- Chat view with message bubbles, timestamps, fixed bottom input.
- Click username to edit nickname (for any user).
- Next Game lineup page with draggable 4-3-3 positions, subs, not-available lists.
- Local merge layer over seed JSON with dedupe-by-id.
- Export local changes bundle for maintainer sync.

## Data source and persistence split

### Seeded from repo JSON (`/public/data`)
- `users.json`
- `events.json`
- `fines.json`
- `messages.json`
- `nicknames.json`
- `lineups.json`

### Persisted locally in browser (`localStorage`)
- current user identity
- locally created users
- locally created messages
- locally created fines
- nickname overrides
- lineup changes

The app merges seed + local layers at runtime, with local records taking priority by `id`.

## Maintainer sync workflow (no server required)

### Export from browser
Use the subtle **Maintainer Sync → Export Changes** button in the app to download a JSON bundle of local changes.

### Merge locally into repo JSON
```bash
npm run sync:changes -- ./path/to/grimacefc-local-changes-YYYY-MM-DD.json
```

Then:
1. Review `git diff`
2. Run tests/build
3. Commit and push

This makes changes part of seed data for everyone on next deployment.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages deployment

1. Push repo to GitHub (default branch: `main`).
2. In repo settings, enable **Pages** and set source to **GitHub Actions**.
3. The included workflow `.github/workflows/deploy-pages.yml` builds Vite and deploys `dist` to Pages.
4. Update `base` in `vite.config.ts` if repository name changes.

## Replacing dummy data with real team data

1. Edit JSON files under `public/data` with real users/events/etc.
2. Keep stable `id` values and ISO timestamps.
3. For lineups, keep `formation: "4-3-3"` and `positions` keys consistent.
4. Commit and redeploy.

## Architecture notes for future backend

The app is structured with separate layers so a backend can be added later:
- `services/dataService.ts` for seed loading
- `utils/storage.ts` for local persistence + merge + export
- page-level components consume centralized app state

A future API client can replace local storage calls while keeping UI logic mostly unchanged.
