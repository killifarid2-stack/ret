-- Stores the per-round winner history (including the tie-break analysis —
-- strike quality, high-value technique count, penalties — for any round
-- that was decided by a points tie) so it can be reviewed later from the
-- Result / Search screen instead of only being shown live during the match.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS round_winners JSONB;
