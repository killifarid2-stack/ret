# Deep Category Archive / Match Result Integration — 2026-09-04

- Fixed duplicate `savedPlayers` declaration in category overview.
- Weight status now considers saved player roster and scheduled bracket players, not matches alone.
- Age-category status now considers populated weights that have players even before the first match starts.
- Local match cache is merged with cloud match status instead of being skipped when cloud rows exist.
- `ADD / EDIT PLAYERS` is locked after a fighting/rest/finished match exists in the selected weight.
- Weight browser now exposes richer statistics and a staged bracket/tree presentation with next/live/done states.
- Winner result presentation now visibly confirms the final method and decisive/result round; KO uses the original local KO artwork.
- Round result cards now show a visible Round Decision panel for ties/decisions, including available reason/criterion and AI/WOO-SE-GIROK evidence.
- Tournament File Center includes custom age/weight categories in its category map and folder counts.
- Par Équipe weight folders now use NOT STARTED / READY / LIVE / FINISHED visual status with glow and player/match counts.
- Existing Player Change Animation ON/OFF behavior remains: ON pauses and plays OUT→IN; OFF changes directly without animation and without pausing the clock.

Validation: TypeScript `tsc --noEmit` passed using the installed global TypeScript compiler. Full Vite/E2E runtime was not run because project dependencies were not fully installed in this working copy.
