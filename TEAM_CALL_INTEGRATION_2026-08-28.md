# Team Call integration — 2026-08-28

The Team Call system is integrated into the main WAB-TKD project.

- Main Referee controls remain in `MainRefereeCallPanel.tsx`.
- Public display uses `broadcast-new/LiveTeamCallBroadcast.tsx`.
- Team/Player/Tournament data are adapted from the existing MatchState.
- No new database is created.
- No existing Player Call, Player Change, Winner, Replay, Par Équipe, or Match Engine is replaced.
- Team Call broadcast now uses a true viewport-locked fullscreen shell to prevent visible outer frames/overflow on TV/capture screens.
