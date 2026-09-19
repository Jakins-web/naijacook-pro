# NaijaCook Pro — Mobile App

A PWA remote for the NaijaCook Pro automated cooking machine — pick a dish,
review the full ingredient breakdown (main slot, vegetable mix, oil/water,
spice pods), set servings, and start or schedule a cook. Talks directly to
Firebase Realtime Database; no backend server.

**Live:** https://<your-username>.github.io/naijacook-pro-app/

## Stack
- Vanilla HTML / CSS / JS (no framework, no build step)
- Firebase Realtime Database (`appliance/control`, `appliance/telemetry`)
- Firebase Anonymous Auth (silent — no login screen)
- Installable as a PWA (manifest + service worker, offline app shell)

## Setup
1. Fill in `firebase-config.js` with your Firebase project's web config.
2. Enable **Anonymous** sign-in: Firebase Console → Authentication → Sign-in method.
3. Publish `database.rules.json` to Realtime Database → Rules.
4. Open `index.html` — no build step needed. Runs in **Demo mode**
   (simulated cook cycle, no real device) until `firebase-config.js` is filled in.

## Structure
| File | Purpose |
|---|---|
| `index.html` | Pages: Home, Foods, Recipe detail, Cooking, Schedule, Settings |
| `style.css` | Theme + all component styles |
| `app.js` | Recipe model, servings scaling, Firebase read/write, navigation |
| `firebase-config.js` | Firebase init + anonymous auth |
| `manifest.json` / `service-worker.js` | PWA installability + offline shell |
| `database.rules.json` | Realtime Database security rules |
