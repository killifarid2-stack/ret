# WAB-TKD — Archive / Replay / Animation Upgrade — 2026-09-07

## Tournament archive
- Persisted roster snapshots inside each tournament's bracket_data so player/club counts survive cloud/local lag.
- Local roster changes are persisted immediately, not only after the main tournament Save button.
- Cloud/local tournament merge now preserves richer local bracket_data, matchRecords, roster snapshots, colors and replay data instead of replacing them with a thinner cloud row.
- Tournament summary can read completed matches from both local match cache and embedded bracket_data.matchRecords.
- Added completion percentage and richer tournament statistics.
- Match archive now shows scheduled/remaining and completed matches together.
- Completed matches show winner, method, round, duration, head hits, Gam-jeom, AI confidence when available, and replay event count.
- Completed matches expose a point-by-point replay viewer based on the exact saved score events.

## Match progression
- Weight folders now expose START FIRST MATCH / START NEXT MATCH / START SEMIFINAL / START FINAL when appropriate.
- Active match state is reflected in the File Center so a live/rest/paused match is not shown as a fresh category.
- Completed matches remain locked and are not treated as playable again.
- Stage hierarchy is visually distinct: Qualification, Round of 16, Quarterfinal, Semifinal and Final.
- Final stage uses a dedicated violet treatment; semifinal uses a dedicated fuchsia treatment.
- Same stage hierarchy is applied to Par Équipe archive.

## Result / replay
- Saved match records now include a replay timeline and replay summary in addition to score_events, round_winners, rounds_data, statistics, referee decisions and AI/WOO-SE-GIROK evidence.
- Result screen explicitly identifies POINT GAP, WOO-SE-GIROK decision and AI-assisted decision when those contexts exist.
- Individual 1v1 finished matches automatically confirm/persist after the cinematic result window, eliminating the dead-end manual Save step. Par Équipe keeps explicit official confirmation.

## Animation / display polish
- Added safe-frame and GPU-friendly motion rules for public result layers.
- R1/R2/R3 result frames use fixed geometry and controlled gaps to prevent overlap or clipping.
- Broadcast winner/result typography is constrained to the safe area.
- Dark/black buttons receive a visible border and hover treatment so they do not disappear into black backgrounds.
- Reduced-motion behavior remains respected.

## Validation
- Changed TS/TSX files were syntax-transpiled successfully with the TypeScript compiler's transpileModule check.
- Full Vite build was not run because the supplied working directory has an incomplete node_modules installation; no claim of a successful production build is made here.
