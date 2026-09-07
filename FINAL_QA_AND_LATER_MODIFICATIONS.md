# WAB-TKD — Final Integration + Later Modifications

This package is based on the full **FINAL INTEGRATION + QA** project and keeps its original source/assets while carrying forward the later requested features.

## Integrated feature set

- Individual-match Winner Animation on the public result flow.
- RED/BLUE dynamic winner presentation and player name.
- WOO-SE-GIROK round-tie flow: AI tie review, summons, countdown, three-referee voting, majority/unanimous decision, final confirmation and public-display mirror.
- Main Referee-only control for WOO-SE-GIROK; Public Display remains read-only.
- Player Call: RED, BLUE, replay, ready state and Matchup sequence.
- Team Call and Team Call replay.
- Par Équipe rotation/substitution handling and substitution cinematic.
- Video Replay with RED/BLUE camera artwork and O/X decision presentation.
- Match Replay / post-match replay access.
- Tournament, weight-category, Par Équipe save/archive and recovery modules already present in the reference.
- Multi-mat conflict/lease protection and release/QA tooling already present in the reference.

## Isolation rules preserved

- Individual winner reveal is only selected for Individual match result frames; Par Équipe uses the team result screen.
- WOO-SE-GIROK is guarded by the tie-decision state and disabled for Par Équipe.
- Public/Broadcast renders shared state and does not receive Main Referee controls.
- Substitution is restricted by the existing Par Équipe substitution guards.

## Verification

`node scripts/final-qa.mjs` performs static integrity checks for the critical animation, state, replay, substitution, and public/operator integration points.

The source package intentionally does **not** include `node_modules`, generated `dist`, or build caches. Those are installation/build artifacts, not project source, and can be regenerated with the package scripts.
