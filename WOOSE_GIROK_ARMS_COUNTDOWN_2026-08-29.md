# WOO-SE-GIROK — Referee Arms Countdown

Implemented in `OperatorScreen.tsx` for individual matches only.

## Flow
1. Round tie remains in Main Referee review.
2. Press `WOO-SE-GIROK — 우세기록` to open the summons scene.
3. The uploaded transparent referee-arm artwork appears centered with the empty space preserved in the middle.
4. `START COUNTDOWN` is a separate operator action.
5. Countdown appears in the center gap:
   - `1` / `HANA — 하나`
   - `2` / `DUL — 둘`
   - `3` / `SET — 셋`
6. The scene ends at `JUDGES SUMMONED`; judge voting/decision UI is intentionally not changed in this phase.

## Visual
- Premium dark broadcast background.
- Gold cinematic glow and moving light sweeps.
- Floating particles.
- Large centered countdown number.
- Gold `HANA — 하나` / `DUL — 둘` / `SET — 셋` label.
- Uploaded artwork: `src/assets/woose-girok-arms.png`.

## Important separation
The WOO-SE-GIROK summons is gated out for `par_equipe`; it remains an individual-match flow only.

## Verification
The project source was edited successfully. A production build could not be executed in this environment because the project dependencies were not installed; `npm install` timed out before Vite became available.
