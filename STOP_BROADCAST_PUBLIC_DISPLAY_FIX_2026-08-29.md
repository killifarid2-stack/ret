# Stop Broadcast / Public Display Fix — 2026-08-29

## Fixed
- Removed stale `poolMvpOverlay` render references from `PublicScoreboard.tsx`. Those references caused the runtime crash `poolMvpOverlay is not defined`.
- Public/audience display is isolated from operator broadcast controls.
- `Start Broadcast` / `Stop Broadcast` no longer renders inside a real public display window.
- If a public display ever crashes, its fallback is an English, isolated `PUBLIC DISPLAY ERROR` screen with no admin/operator navigation.
- The normal public scoreboard remains English/LTR independently of the admin language.

## Important behavior
- Operator/Admin UI can continue using Arabic.
- Audience/Public Display stays English and must not expose internal navigation.
- Stop Broadcast is an operator action; the audience window only receives the resulting broadcast state.
