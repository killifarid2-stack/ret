# WAB-TKD — AI Tiebreaker + Team Call isolation

- Restored/kept the Individual round-tie AI Tiebreaker workflow from the reference archive while preserving the current richer deterministic evidence model.
- When an individual round ends tied, the Main Referee tie screen exposes `AI TIEBREAKER` and `WOO-SE-GIROK`.
- AI Tiebreaker is a recommendation only. If the evidence is insufficient/too close, it returns `UNABLE TO DETERMINE` and does not resolve the round; the AI button remains available and the referee can use WOO-SE-GIROK/manual decision.
- Team Call remains a dedicated Par Équipe animation/control flow.
- Added `CANCEL TEAM CALL`, scoped only to Team Call. It never clears an active Player Call or Matchup animation.
- `PLAYER CALL CONTROLS` is visible/openable only when `competitionMode === 'par_equipe'`; it is not coupled to the Team Call animation.
- No existing working animation assets were replaced.
