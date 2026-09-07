# WAB-TKD — Final hardening additions — 2026-09-05

- Added UI anti-double-action guard (450 ms) for critical transition/broadcast commands.
- Kept timer and internal animation deadline dispatches unthrottled.
- Added generic MATCH LOCK for player identity after a bout has started or recorded score events.
- Par Équipe player changes remain on the dedicated substitution path.
- Existing animation queue/call sequence remains the source of truth; no new artwork/assets were generated.
- Existing crash recovery remains active and continues to require explicit referee resume/ready actions after restore.
