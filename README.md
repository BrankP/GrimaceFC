# Grimace FC (GitHub Pages Static Team Hub)

A mobile-first React + Vite website for a social soccer team, deployable to GitHub Pages with no backend server.

## Static hosting limitation

GitHub Pages is static. Browser users cannot safely write directly to repo JSON without exposing privileged credentials. This app uses repo seed data + browser-local persistence.

## Features

- Name gate on first load; returning users skip directly to the app.
- Default landing tab is **Upcoming Games** after user recognition.
- Upcoming events grouped by month, sorted ascending.
- Per-event availability actions for the current user:
  - ✅ Available
  - ❌ Not available
- Fines page with modal submission + filters.
- Chat page with nickname editing.
- Next Game lineup page with drag/drop 4-3-3 positions.
- Availability drives lineup buckets:
  - Available unassigned users appear in **Subs**
  - Not available users appear in **Not available**

## Data model

Seed JSON lives in `public/data`:
- `users.json`
- `events.json`
- `fines.json`
- `messages.json`
- `nicknames.json`
- `lineups.json`
- `availability.json`

## Browser persistence

Stored in `localStorage`:
- current user identity
- local users/messages/fines/nicknames/lineups
- per-event availability records

When a new user joins, availability records are created for every event with default status `not_available`.

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

1. Push to GitHub (`main`).
2. In Settings → Pages, select **GitHub Actions**.
3. The workflow `.github/workflows/deploy-pages.yml` builds and deploys `dist`.

## Replacing seed data

1. Update files under `public/data`.
2. Keep IDs stable and timestamps in ISO format.
3. For lineups, keep `formation: "4-3-3"` and standard position keys.
