# WAB-TKD — Main Referee UI / Round Correction Fix — 2026-08-28

## Changes

1. **Runtime error fixed**
   - Removed stale `mvpOverlay` references from `PublicScoreboard.tsx`.
   - This fixes the `mvpOverlay is not defined` crash shown on the public screen.

2. **WARNING live button removed**
   - Removed the live `WARNING` scoring button from the player scoring panel.
   - Existing warning/event data and referee correction infrastructure remain intact.

3. **Player Call / Team Call isolation**
   - The yellow header `استدعاء اللاعبين` control is now the 1v1 Player Call entry point only.
   - It is hidden for Par Équipe.
   - The lower `PLAYER CALL CONTROLS` / `TEAM CALL CONTROLS` Main Referee panel is shown only for Par Équipe.
   - This prevents 1v1 and Par Équipe call controls from overlapping.

4. **Professional Main Referee result screen**
   - Replaced the old fullscreen winner-color overlay shown to the Main Referee after a match.
   - Added a dark professional result/review panel with:
     - Match number
     - Blue/Red players
     - Final score
     - Round wins
     - Winner
     - Win method
     - Head hits
     - Total hits
     - Match History / View
     - PDF
     - Save Match
     - Reset / Return

5. **Post-match round correction**
   - Added `EDIT R1`, `EDIT R2`, etc. and `EDIT LAST DECIDING ROUND`.
   - Correction mode never starts the timer.
   - Correction mode never replays intro / Player Call animations.
   - Referee can add historical points, Gam-jeom, warning ×1, or critical last-10s warning ×2.
   - `SHOW UPDATED RESULT` recalculates the affected round and determines whether the match proceeds to rest or the winner state.

6. **Critical last-10s correction**
   - A corrected warning confirmed as occurring in the final 10 seconds now records the configured scoring consequence without restarting the clock.
   - The correction is kept in the existing event model so statistics/recalculation remain based on match events.

## Verification

- TypeScript/TSX syntax transpilation check: PASS for all modified files.
- Full Vite production build was not executed because dependency installation in the isolated environment timed out; no source syntax errors were found in the modified files.
