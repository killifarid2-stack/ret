# Winner Animation — Final Asset/Timing Pass — 2026-09-05

- Winner intro uses the project's local `src/assets/medal.png` artwork.
- Player photo, country flag and club logo remain sourced from live MatchState/local assets.
- Local WAB-TKD app icon and transparent trophy asset remain packaged; no external image URL is introduced by the winner intro.
- Typography keeps the project's existing Orbitron / Rajdhani / Cairo stack.
- Fixed a timing issue where the cinematic overlay could fade out at 2.2s even when Settings requested 3–10s. The master/vignette/rays animations now use `--winner-intro-duration`.
- Fixed the end-of-intro state so it remains visible until React switches to the final result, avoiding a blank-frame flash.
- Reduced-motion mode keeps the intro visible instead of hiding it.
- No new project, database, or mock winner data was introduced.

Validation note: the source changes were inspected. A full npm build could not be completed in this environment because dependency installation timed out; therefore do not treat this delivery as a replacement for the project's own local `npm run build` / `npm run qa` gate.
