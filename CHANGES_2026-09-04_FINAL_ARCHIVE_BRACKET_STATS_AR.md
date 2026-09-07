# WAB-TKD — Final Archive / Bracket / Statistics pass

## Added
- Weight category archive statistics now aggregate saved match records with:
  players, matches, finished, remaining, live, wins, methods, points, head/body points, gam-jeom, knockdowns, AI rounds and WOO-SE-GIROK rounds.
- Per-player table inside each weight with matches, wins, losses, points, head/body points, gam-jeom and knockdowns.
- Bracket view upgraded from a simple list into a staged winner-path tree: Qualification, R16, QF, SF, Final, with match status, winner, method and score.
- Saved match rows now expose score, method, result round and stage when available.
- Cloud category match retrieval now includes the saved result/statistics fields needed by the archive.

## Preserved
- Existing HOME/V35 structure.
- Original animation/assets and Public/Main Referee separation.
- Local-first/offline persistence.
- Existing category hierarchy and custom category behavior.

## Validation
- TypeScript `tsc --noEmit` passed.
- No runtime/E2E claim is made in this pass.
