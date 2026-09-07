# AI Tie Analysis + WOO-SE-GIROK — 2026-08-30

- Applies only to INDIVIDUAL MATCH when a completed round has equal BLUE/RED score.
- Normal non-tied rounds keep the existing match engine path.
- AI analysis uses only real round ScoreEvent data already present in WAB-TKD: valid scoring actions, head/body/punch/turning actions, effective scored points, activity and gam-jeom. It does not invent attack-attempt or success-rate metrics when those data are absent.
- AI returns recommendation + confidence + explainable evidence; it never awards the round automatically.
- A clear AI recommendation can be confirmed by the Main Referee. Otherwise the referee can open WOO-SE-GIROK.
- WOO-SE-GIROK runs as a shared broadcast state: summons → HANA/DUL/SET countdown → three referee votes → center referee final confirmation.
- Public/Broadcast Display is read-only and mirrors the tie-review state; it has no control buttons.
- Three judges each choose BLUE or RED. Majority is calculated, but the system waits for CENTER / MAT REFEREE confirmation before recording the round winner.
- AI recommendation and final referee decision are stored separately on the round record.
- New Admin → Match Rules toggles: AI Tie Analysis, WOO-SE-GIROK, Referee Majority, Broadcast Animation.
- Par Équipe is excluded from this individual tie flow.
