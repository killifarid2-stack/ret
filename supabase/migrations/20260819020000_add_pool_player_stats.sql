-- "أفضل لاعب في البولة" (Pool MVP) — unlike mvpReveal (computed purely from
-- the CURRENT match's local teamRoster[].roundScores, never persisted),
-- this needs a player's totals across every match they've played within
-- the same tournament (= the pool). That can't live in MatchState, which
-- only ever holds one match at a time — it needs its own cross-match table.
--
-- One row per (tournament, team, player). Updated via the
-- increment_pool_player_stats() RPC below every time a Par Équipe match
-- with a teamRoster finishes, so totals accumulate match over match instead
-- of being overwritten.
CREATE TABLE IF NOT EXISTS public.pool_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL DEFAULT '',
  player_name TEXT NOT NULL,
  nationality TEXT,
  player_number INTEGER,
  photo TEXT,
  total_points INTEGER NOT NULL DEFAULT 0,
  total_gamjeom INTEGER NOT NULL DEFAULT 0,
  matches_played INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, team_name, player_name)
);

ALTER TABLE public.pool_player_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read pool_player_stats" ON public.pool_player_stats;
DROP POLICY IF EXISTS "Auth insert pool_player_stats" ON public.pool_player_stats;
DROP POLICY IF EXISTS "Auth update pool_player_stats" ON public.pool_player_stats;
DROP POLICY IF EXISTS "Auth delete pool_player_stats" ON public.pool_player_stats;

-- Matches this project's existing convention: public read (the broadcast/
-- public scoreboard reads it directly), authenticated write (the operator
-- app signs in anonymously — see integrations/supabase/client.ts — purely
-- to satisfy this gate, same as every other writable table here).
CREATE POLICY "Public read pool_player_stats" ON public.pool_player_stats FOR SELECT USING (true);
CREATE POLICY "Auth insert pool_player_stats" ON public.pool_player_stats FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update pool_player_stats" ON public.pool_player_stats FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete pool_player_stats" ON public.pool_player_stats FOR DELETE TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.pool_player_stats FROM anon;
GRANT SELECT ON public.pool_player_stats TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pool_player_stats TO authenticated;
GRANT ALL ON public.pool_player_stats TO service_role;

CREATE INDEX IF NOT EXISTS idx_pool_player_stats_tournament_id ON public.pool_player_stats (tournament_id);
CREATE INDEX IF NOT EXISTS idx_pool_player_stats_points ON public.pool_player_stats (tournament_id, total_points DESC);

DROP TRIGGER IF EXISTS trg_pool_player_stats_updated_at ON public.pool_player_stats;
CREATE TRIGGER trg_pool_player_stats_updated_at BEFORE UPDATE ON public.pool_player_stats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Atomic increment — the app never reads-then-writes a total itself (that
-- would race across mats/operators finishing matches at the same time on
-- the same tournament); it always calls this instead, once per roster
-- player who actually played (roundScores.length > 0) when a match ends.
CREATE OR REPLACE FUNCTION public.increment_pool_player_stats(
  p_tournament_id UUID,
  p_team_name TEXT,
  p_player_name TEXT,
  p_nationality TEXT,
  p_player_number INTEGER,
  p_photo TEXT,
  p_points INTEGER,
  p_gamjeom INTEGER
) RETURNS void AS $$
BEGIN
  INSERT INTO public.pool_player_stats (
    tournament_id, team_name, player_name, nationality, player_number, photo,
    total_points, total_gamjeom, matches_played
  ) VALUES (
    p_tournament_id, COALESCE(p_team_name, ''), p_player_name, p_nationality, p_player_number, p_photo,
    GREATEST(p_points, 0), GREATEST(p_gamjeom, 0), 1
  )
  ON CONFLICT (tournament_id, team_name, player_name) DO UPDATE SET
    total_points   = public.pool_player_stats.total_points + GREATEST(EXCLUDED.total_points, 0),
    total_gamjeom  = public.pool_player_stats.total_gamjeom + GREATEST(EXCLUDED.total_gamjeom, 0),
    matches_played = public.pool_player_stats.matches_played + 1,
    nationality    = COALESCE(EXCLUDED.nationality, public.pool_player_stats.nationality),
    player_number  = COALESCE(EXCLUDED.player_number, public.pool_player_stats.player_number),
    photo          = COALESCE(EXCLUDED.photo, public.pool_player_stats.photo),
    updated_at     = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.increment_pool_player_stats TO authenticated;
