-- MULTI-MAT CONTROL ROOM — see DOCUMENTATION.md §8 for the full bilingual
-- explanation of the design decision behind this table.
--
-- One row per physical mat number, overwritten (never inserted twice) by
-- whichever Electron/browser instance is currently the operator for that
-- mat. This is a best-effort LIVE HEARTBEAT, not a source of truth for
-- match results — finished matches are still recorded exactly as before,
-- in the `matches` table (see match-local.ts / OperatorScreen.tsx save
-- logic, completely untouched by this feature). If a heartbeat goes stale
-- (no update for a while — see mat-status.ts STALE_MS), the Control Room
-- page shows that mat as unknown/offline rather than trusting old data.
--
-- Deliberately NOT used to make one window "own" or drive several mats'
-- live scoring simultaneously — every mat still has exactly one operator
-- entering scores for it at any moment (same single-MatchContext-per-window
-- model as before). This table only lets a Control Room window WATCH every
-- mat side-by-side and SWITCH which mat this window is actively operating,
-- which is what was actually requested.

CREATE TABLE IF NOT EXISTS public.mat_live_status (
  mat_number INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'idle', -- 'idle' | 'waiting' | 'running' | 'paused' | 'finished'
  competition_name TEXT,
  match_number INTEGER,
  chung_name TEXT,
  hong_name TEXT,
  chung_nationality TEXT,
  hong_nationality TEXT,
  chung_club TEXT,
  hong_club TEXT,
  chung_player_number INTEGER,
  hong_player_number INTEGER,
  weight_category TEXT,
  match_stage TEXT,
  team_chung TEXT,
  team_hong TEXT,
  chung_score INTEGER,
  hong_score INTEGER,
  current_round INTEGER,
  tournament_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mat_live_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read mat_live_status" ON public.mat_live_status;
DROP POLICY IF EXISTS "Auth upsert mat_live_status" ON public.mat_live_status;
DROP POLICY IF EXISTS "Auth update mat_live_status" ON public.mat_live_status;
DROP POLICY IF EXISTS "Auth delete mat_live_status" ON public.mat_live_status;

-- Same convention as every other table here (see e.g.
-- 20260819020000_add_pool_player_stats.sql): public read so the Control
-- Room / public displays can watch live status directly, authenticated
-- write for the operator apps (anon signs in anonymously — see
-- integrations/supabase/client.ts).
CREATE POLICY "Public read mat_live_status" ON public.mat_live_status FOR SELECT USING (true);
CREATE POLICY "Auth upsert mat_live_status" ON public.mat_live_status FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update mat_live_status" ON public.mat_live_status FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete mat_live_status" ON public.mat_live_status FOR DELETE TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.mat_live_status FROM anon;
GRANT SELECT ON public.mat_live_status TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_live_status TO authenticated;
GRANT ALL ON public.mat_live_status TO service_role;

CREATE INDEX IF NOT EXISTS idx_mat_live_status_updated_at ON public.mat_live_status (updated_at DESC);
