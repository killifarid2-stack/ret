# WAB-TKD — Par Équipe scoring mode + live AI tie analysis

- Par Équipe now has an explicit scoring-mode switch:
  - RESET EACH ROUND: each round starts at 0 and the final winner is the team that wins more rounds.
  - CUMULATIVE: points remain active across rounds and the final winner is the team with the highest total score.
- Warning/gam-jeom reset remains independently configurable from Admin / Tournament / Par Équipe setup.
- Final Par Équipe reveal no longer always uses cumulative points; it follows the selected scoring mode.
- A true final tie is not silently awarded to Blue: it remains pending for referee resolution.
- Main Referee now gets a live `AI TIE ANALYSIS` button during a fighting round whenever the current round score is tied (including Par Équipe).
- The live AI button disappears immediately when Blue or Red takes the lead.
- Live AI analysis is informational only; it never silently awards the round or replaces the official referee/WOO-SE-GIROK decision flow.
