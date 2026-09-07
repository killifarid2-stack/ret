# WAB-TKD — Final QA Notes — 2026-09-04

## Static verification completed
- `package.json` contains build, unit-test, E2E, release and production checks.
- Winner Result is isolated through `IndividualWinnerAnimation` and `MatchResultScreen`.
- Winner Result uses local KO assets and `FlagImage`/local flags.
- Category archive exposes Gender → Age → Weight and weight status circles.
- Manual weight suspension/resume exists.
- Match records persist round winners, referee decision data, AI score/confidence, timer state, animation state and match snapshot.
- Par Équipe substitution is guarded by `teamMode === 'substitution'` and match live/paused/between-round states.

## Final hardening applied
- Removed the hard-coded `CADET_MEN_63KG` fallback from Winner Result; missing category now displays `—` rather than fabricated competition data.
- Removed generic player placeholder artwork from Winner Result. If the winner has no photo asset, the result screen does not manufacture a replacement image.
- Updated Winner Result type documentation so flag values are treated as local asset codes/keys, rendered through the local flag component.

## Runtime limitation
The archive does not contain `node_modules`, so full `npm run test`, `npm run test:e2e`, and `npm run build` cannot be truthfully marked PASS from this environment without installing dependencies. The source/package structure is present for those checks.
