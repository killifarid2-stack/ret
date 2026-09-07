# Player Call — Arena Glory Integration — 2026-08-30

- Replaced the Par Équipe-specific legacy Player Call renderer with the supplied Arena Glory cinematic Player Call renderer already present in the project's broadcast package.
- Kept `PLAYER CALL CONTROLS` and all Main Referee state/selection logic unchanged; the new renderer is an adapter over the existing live MatchState.
- Kept Player Call animation separate from the Player Change / substitution animation.
- `PLAYER READY / CONFIRM` continues to send the public display to LIVE after exactly 3 seconds on final confirmation.
- Default `playerCallGoLiveDelaySeconds` is now 3 seconds, and the TV / GO LIVE fallback uses 3 seconds as well.
- No score, timer, round, roster, or tournament data is changed by the renderer.
