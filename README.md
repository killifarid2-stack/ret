# TKD PSS — Taekwondo Scoring System

Web-based KPNP-style scoring system with public scoreboard, operator console,
side-judge PWA, golden-point logic, and tournament management.

## Tech

- React 18 + Vite + TypeScript + Tailwind
- Lovable Cloud (Supabase) for realtime sync, auth, storage
- PWA installable on iOS / Android home screen

---

## Packaging as APK / EXE (Capacitor)

The judge & operator app can be wrapped as a **native Android APK / iOS app /
Windows EXE** using Capacitor. The web build is unchanged; Capacitor adds a
native shell around it.

### One-time setup

```bash
# Inside your Github clone of this project
npm install
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init "TKD PSS" app.lovable.ce34a8fbdc654de6a387392823b2327b
```

In `capacitor.config.ts`, optional hot-reload from the Lovable sandbox:

```ts
server: {
  url: "https://ce34a8fb-dc65-4de6-a387-392823b2327b.lovableproject.com?forceHideBadge=true",
  cleartext: true,
}
```

Remove that `server` block before shipping a production binary.

### Android (APK)

```bash
npx cap add android
npm run build
npx cap sync android
npx cap open android   # opens Android Studio → Build > Generate Signed APK
```

Requirements: Android Studio + JDK 17.

### iOS

```bash
npx cap add ios
npm run build
npx cap sync ios
npx cap open ios       # opens Xcode → Product > Archive
```

Requirements: macOS + Xcode.

### Windows EXE

Capacitor does not target Windows directly. Two supported paths:

1. **Electron wrapper** — `npm i -D electron electron-builder`, point Electron
   at `dist/`, run `electron-builder --win` to produce a portable `.exe`.
2. **PWA install** — Edge / Chrome on Windows can install the existing PWA as
   an `.exe`-equivalent app via "Install this site as an app".

For most operators the **PWA install** is the simplest path — open the
deployed scoreboard URL in Edge → menu → *Apps* → *Install this site as an app*.

### After every web change

```bash
git pull
npm run build
npx cap sync
```

---

## Features overview

- **Operator console** — full match control, score buttons, gamjeom, kyeshi,
  golden-point handling, IVR, judge approvals, swap players, quick-match form,
  tournament library (saved presets).
- **Public scoreboard** — 1080p / 4K optimized, tournament header
  (`MEN/WOMEN · AGE · WEIGHT · MATCH #`), green **FIGHT** badge, per-round
  score boxes, gamjeom dots, hit breakdown (punch/body/head) with pulse
  animation, action-flash positioned above warnings.
- **Tie-round flow** — when a round ends in a draw, the operator is prompted
  to pick the round winner before REST begins. The final tie triggers a
  **Golden Round** (first point wins).
- **Side-judge PWA** — judges install from `/judge` to their phone home
  screen; their scores go through approval/IVR.
- **Persistent display settings** — hit-icon size, round-box border, gamjeom
  circle size are saved in localStorage and carry over between matches.

## Memory rules

Project decisions live under `.lovable/memory/` (Orbitron headings,
chung/hong colour scheme, KPNP reference, etc.). Do not regress them.


## Multi-Mat operation — computer assignment + central wall

Each physical operator computer can now be assigned a permanent local MAT number from Admin → Multi-Mat. The assignment is stored only on that computer, and the Operator screen uses it automatically; the manual Mat field becomes read-only while an assignment exists. A friendly device name can also be stored.

All mat computers point to the same Supabase project. Each operator publishes a best-effort heartbeat under its assigned MAT number. The Control Room and the read-only `/tournament-wall` screen read those heartbeats, so one central screen can monitor all mats without sharing scoring state between machines. The central wall never controls or changes a match.

Tournament Control Center also supports a per-tournament MAT WORKLOAD plan: each mat can be assigned one or more weight categories. Auto Queue respects that plan and also blocks a player who is already live or already queued on another mat.

For events split into separate saved tournaments per weight category, assign the same physical mat to multiple category tournaments; the scheduler will only place a match on a mat when that category is allowed.

## QA / Test Center

The protected `/qa-test-center` route provides a controlled release matrix for Authentication, End-to-End Match Flow, Par Équipe recovery, Multi-Mat synchronization, Dual Screen/Broadcast, Statistics/MVP, Export/History, and Emergency Recovery. Test status is stored locally on the operator station and can be exported as JSON. The release gate remains `NOT READY` until every listed suite is marked `PASS`.

## Final Integration / QA

- `/qa-test-center` now includes deterministic local automated checks for recovery, Par Équipe snapshots, multi-mat ownership conflicts, permissions, displays, export and performance probes.
- `src/lib/mat-conflict.ts` provides a short-lived per-match control lease to prevent two operator windows on the same station from controlling the same live match.
- `src/lib/release-readiness.ts` provides a local release gate and final checklist without touching scoring/judging state.
- Playwright smoke tests live under `tests/e2e/` and can be run with `npm run test:e2e`.
- Full QA command: `npm run qa`.
