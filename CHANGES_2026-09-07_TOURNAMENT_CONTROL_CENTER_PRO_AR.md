# WAB-TKD — Tournament Control Center Pro / Animation Flow Upgrade

## Implemented
- Rebuilt `/tournament-control` as a stage-aware tournament operations/archive center.
- Single drill-down path: Tournament → Gender → Age Group → Weight → Matches → Results.
- Category metrics: Players, Clubs, Matches, Completed, Remaining, Progress.
- Explicit lifecycle/status display: NOT_STARTED / READY / LIVE / COMPLETED / LOCKED / FINISHED.
- Stage highlighting: Qualification, Round of 16, Quarter-Final, Semi-Final and Final; Semi-Final and Final receive dedicated purple/fuchsia visual treatment.
- Match history now exposes winner, method, duration and point-replay availability from saved match records.
- Bracket roadmap groups matches by stage and distinguishes completed matches.
- Player roster and club registry views use persisted tournament roster plus saved match records as fallback.
- Archive health indicators verify roster, clubs, match records and point replay data.
- Live mat monitor is read-only and refreshes with the tournament state.
- Strong borders were added to dark/black controls so buttons remain visible on dark broadcast/operator surfaces.

## Animation / result control
- Winner animation now listens for a `wab-skip-winner-animation` event.
- Main Operator result view has `SKIP RESULT ANIMATION` for individual matches; it moves the public result layer directly to the result phase without changing the official result data.
- The public layer remains read-only; the operator/referee remains the controller.

## Persistence model retained
- Existing local-first tournament and match persistence remains the source of truth for offline operation.
- Existing point-by-point replay data (`score_events` / `replay_timeline`) remains intact and is surfaced by the archive.

## Validation
- TypeScript project check: PASS (`tsc --noEmit`).
- Vite production build could not run in this execution environment because the extracted workspace has no installed `vite` binary (`node_modules/.bin/vite` unavailable). No claim of a production build was made.
