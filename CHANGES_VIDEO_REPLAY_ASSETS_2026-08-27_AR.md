# Video Replay assets integration

- Added the supplied blue and red Video Replay images to `src/assets/hit-stats/`, alongside glove/headgear/hogu assets.
- Public Display now replaces the generic Video icon and yellow replay-card circles with the supplied artwork.
- Blue artwork appears while that side still has at least one IVR/video-replay request.
- Red artwork appears when that side has no IVR/video-replay requests remaining.
- Remaining replay count is still dynamic and displayed as text when available; match state and IVR deduction logic were not replaced.
