-- MULTI-MAT TOURNAMENT QUEUE
CREATE TABLE IF NOT EXISTS public.mat_match_queue (
  mat_number INTEGER PRIMARY KEY,
  tournament_id UUID NOT NULL,
  bracket_match_id TEXT NOT NULL,
  match_number INTEGER NOT NULL,
  player1 JSONB NOT NULL,
  player2 JSONB NOT NULL,
  round INTEGER,
  total_rounds INTEGER,
  status TEXT NOT NULL DEFAULT 'queued',
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ
);
ALTER TABLE public.mat_match_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read mat_match_queue" ON public.mat_match_queue;
DROP POLICY IF EXISTS "Auth write mat_match_queue" ON public.mat_match_queue;
CREATE POLICY "Public read mat_match_queue" ON public.mat_match_queue FOR SELECT USING (true);
CREATE POLICY "Auth write mat_match_queue" ON public.mat_match_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE INSERT, UPDATE, DELETE ON public.mat_match_queue FROM anon;
GRANT SELECT ON public.mat_match_queue TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_match_queue TO authenticated;
GRANT ALL ON public.mat_match_queue TO service_role;
CREATE INDEX IF NOT EXISTS idx_mat_match_queue_tournament ON public.mat_match_queue (tournament_id);
