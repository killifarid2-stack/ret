-- Par Équipe matches need to keep their team identity once saved to
-- history (Result / Search screens), not just the individual roster
-- player who happened to be on the mat for the last round. Without these
-- columns, a finished Par Équipe match looks identical to a normal
-- individual match in the saved record.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS competition_mode TEXT,
  ADD COLUMN IF NOT EXISTS team_names JSONB;
