# Dual-Screen Public Scoreboard (Electron)

This adds a professional two-window desktop system on top of the existing
Electron app:

- **Operator window** — the normal app window (unchanged), where you run
  `/operator`, `/admin`, etc.
- **Public Scoreboard window** — a second, borderless, fullscreen
  `BrowserWindow` that always shows `/scoreboard`, meant to be shown on an
  HDMI TV or a wireless display connected to the venue PC.

## Files

| File | Purpose |
|---|---|
| `electron/main.cjs` | Rewritten. Manages both windows, detects display connect/disconnect, opens/closes/repositions the public window, persists the chosen display, and relays match-state IPC messages. |
| `electron/preload.cjs` | **New.** Exposes a safe `window.electronAPI` bridge (contextIsolation-safe, no Node access leaked to the page). |
| `src/types/electron.d.ts` | **New.** TypeScript types for `window.electronAPI`. |
| `src/context/MatchContext.tsx` | The operator window now broadcasts every match-state change over IPC; the public window never runs its own clock and only mirrors state pushed to it, so the two screens can never drift apart. |
| `src/App.tsx` | Added `PublicWindowGate`, which sends the second window straight to `/scoreboard` on load. |
| `src/components/PublicDisplayControl.tsx` | **New.** The "Open/Close Public Display" control + display picker, shown in the top nav (Electron only — invisible on the web/PWA build). |
| `src/components/TopNav.tsx` | Now renders `PublicDisplayControl`. |
| `src/lib/i18n.ts` | Added EN/AR strings for the new control. |

## How it works

1. On launch, `main.cjs` looks for any display other than the primary one.
   If found, it automatically opens the Public Scoreboard window on it,
   fullscreen, borderless.
2. `screen.on('display-added' / 'display-removed')` keeps watching for
   HDMI/wireless connect-disconnect events for the whole session:
   - Connect → auto-opens the public window (unless the operator explicitly
     closed it earlier while the screen was still connected).
   - Disconnect → closes the public window automatically, and clears the
     "manually closed" flag so the *next* reconnect auto-reopens it again.
3. Only one public window can ever exist — `openPublicWindow()` focuses the
   existing one instead of creating a second.
4. The chosen display id is persisted to
   `app.getPath('userData')/display-config.json`, so it's remembered next
   time the app starts, and across reconnects.
5. Every match-state change (time, score, rounds, gamjeom/penalties, player
   names, flags/nationality — the entire `MatchState`) is pushed from the
   operator window to the public window instantly via
   `ipcRenderer.send('match-state-broadcast', state)` →
   `ipcMain` relays it → `publicWin.webContents.send('match-state-sync', state)`.
6. The "Open Public Display" / "Close Public Display" buttons and the
   display picker live in the top nav bar (only rendered when
   `window.electronAPI` exists, i.e. inside the Electron shell).

## Running it

```bash
npm install
npm run build          # builds the web app into dist/
npm run electron:build # packages the Electron app (or just `npx electron .` after build, for a quick local test)
```

## Known pre-existing gap (not part of this feature)

`src/App.tsx` and `src/hooks/use-toast.ts` import from `@/components/ui/*`
(shadcn toaster/sonner components), but that folder is **not present** in
this export of the repository. This will make `npm run build` fail on a
"Cannot find module '@/components/ui/toaster'" error — unrelated to the
dual-screen feature above. Regenerate those components with
`npx shadcn@latest add toast sonner`, or ask me to scaffold minimal
replacements.

## v48 Dynamic TV selection

The external display is now operator-selected instead of auto-opened. When a new HDMI/Wireless Display is detected, the operator chooses Live Match, Mat Announcer, or Upcoming Matches. Each TV stores its own mode and mat number, so two TVs can show different content. The decision can be changed later without unplugging the display.
