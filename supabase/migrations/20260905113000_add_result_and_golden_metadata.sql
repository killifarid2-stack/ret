-- Explicit final-result fields prevent Golden Round scores from being confused with cumulative match totals.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS result_chung_score INTEGER,
  ADD COLUMN IF NOT EXISTS result_hong_score INTEGER,
  ADD COLUMN IF NOT EXISTS golden_point_win BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS golden_round INTEGER,
  ADD COLUMN IF NOT EXISTS golden_win_criterion TEXT;

COMMENT ON COLUMN public.matches.result_chung_score IS 'Official final-result score; for Golden Round results this is the Golden Round score only.';
COMMENT ON COLUMN public.matches.result_hong_score IS 'Official final-result score; for Golden Round results this is the Golden Round score only.';
COMMENT ON COLUMN public.matches.golden_point_win IS 'True only when the Golden Round was won by 2 points or 2 Gam-jeoms (GDP).';
COMMENT ON COLUMN public.matches.golden_round IS 'Round number in which the Golden Round result was recorded.';
COMMENT ON COLUMN public.matches.golden_win_criterion IS 'GOLDEN_POINTS or SUPERIORITY for a Golden Round result.';
