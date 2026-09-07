-- Structural hardening pass (no behavior change to the app, purely
-- performance/integrity/auditability improvements):
--
-- 1) Indexes on every foreign key and every column the app repeatedly
--    filters/sorts by. Postgres does NOT automatically index foreign key
--    columns — without these, queries like "all matches for this
--    tournament", "all events for this match", or "the players in this
--    tournament" (all used throughout TournamentManager/OperatorScreen/
--    ResultView) fall back to sequential scans that get slower as a
--    club's match history grows across seasons.
--
-- 2) `updated_at` on the four tables that get repeatedly updated during a
--    live event (matches especially — every score change is an UPDATE).
--    Only `created_at` existed before, so there was no way to tell when a
--    row was last touched, which matters both for debugging ("did this
--    match actually get the last score update saved?") and for any future
--    sync/backup tooling that wants to fetch "what changed since X".

-- --- updated_at columns -----------------------------------------------------
ALTER TABLE public.matches      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.tournaments  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.players      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.clubs        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_matches_updated_at ON public.matches;
CREATE TRIGGER trg_matches_updated_at BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tournaments_updated_at ON public.tournaments;
CREATE TRIGGER trg_tournaments_updated_at BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_players_updated_at ON public.players;
CREATE TRIGGER trg_players_updated_at BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_clubs_updated_at ON public.clubs;
CREATE TRIGGER trg_clubs_updated_at BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --- indexes -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id   ON public.matches (tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_chung_player_id ON public.matches (chung_player_id);
CREATE INDEX IF NOT EXISTS idx_matches_hong_player_id  ON public.matches (hong_player_id);
CREATE INDEX IF NOT EXISTS idx_matches_status          ON public.matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_mat_number      ON public.matches (mat_number) WHERE mat_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_finished_at     ON public.matches (finished_at DESC) WHERE finished_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_match_events_match_id   ON public.match_events (match_id);

CREATE INDEX IF NOT EXISTS idx_players_tournament_id   ON public.players (tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournaments_status      ON public.tournaments (status);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_at  ON public.tournaments (created_at DESC);
