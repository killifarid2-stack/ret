# SAVE Context Fix — 2026-09-03

- Top-bar SAVE is now context-aware.
- `/tournament` dispatches `wab-save-tournament` and uses the same `handleSaveTournament()` persistence path as the Tournament Settings SAVE button.
- `/operator` continues to dispatch `wab-save-match` and keeps the official finished-match save flow.
- Tournament SAVE therefore stores the selected Tournament + Gender + Age + Weight + Format category, including players, bracket/league, rules, team rosters and stage data, using the existing local-first multi-category storage.
- No scoring, match engine, database schema, or animation flow was changed.
