-- Needed for the new "Result" screen (match results list + printable
-- single-match report): the mat/court number, and a head-vs-trunk points
-- breakdown per player (computed from the score event log when a match
-- finishes).

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS mat_number INTEGER,
  ADD COLUMN IF NOT EXISTS chung_head_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chung_trunk_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hong_head_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hong_trunk_points INTEGER DEFAULT 0;
