-- Add columns needed to show gender / age group / knockout stage on the
-- Operator screen's TournamentBar, and to let "Save Tournament" persist
-- the full picture (players + generated bracket) so a saved tournament
-- can be fully restored later.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS age_group TEXT,
  ADD COLUMN IF NOT EXISTS match_stage TEXT;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL;

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS bracket_data JSONB DEFAULT '[]';
