-- WAB-TKD final archive/audit layer. Additive only: no existing tables are
-- removed or changed in a destructive way.
CREATE TABLE IF NOT EXISTS public.tournament_archive_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_key TEXT NOT NULL,
  tournament_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  age_group TEXT NOT NULL,
  weight_category TEXT NOT NULL,
  format TEXT DEFAULT 'knockout',
  parent_key TEXT,
  status TEXT DEFAULT 'NOT_STARTED',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tournament_key, gender, age_group, weight_category)
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  actor TEXT,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  category TEXT
);

ALTER TABLE public.tournament_archive_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read tournament_archive_nodes" ON public.tournament_archive_nodes;
DROP POLICY IF EXISTS "Auth write tournament_archive_nodes" ON public.tournament_archive_nodes;
CREATE POLICY "Public read tournament_archive_nodes" ON public.tournament_archive_nodes FOR SELECT USING (true);
CREATE POLICY "Auth write tournament_archive_nodes" ON public.tournament_archive_nodes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Auth insert audit_log" ON public.audit_log;
CREATE POLICY "Auth read audit_log" ON public.audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_archive_nodes_parent ON public.tournament_archive_nodes(parent_key);
CREATE INDEX IF NOT EXISTS idx_archive_nodes_status ON public.tournament_archive_nodes(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON public.audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_tournament ON public.audit_log(tournament_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_match ON public.audit_log(match_id);


-- Final hardening: explicit path uniqueness + timestamp indexes used by
-- deterministic cloud/local conflict resolution. Existing rows are preserved.
CREATE UNIQUE INDEX IF NOT EXISTS idx_archive_nodes_unique_path
  ON public.tournament_archive_nodes(tournament_key, gender, age_group, weight_category);
CREATE INDEX IF NOT EXISTS idx_archive_nodes_updated_at ON public.tournament_archive_nodes(updated_at DESC);

-- Audit entries are append-only evidence. Operators can insert/read when
-- authenticated, but an application client must never rewrite or delete them.
DROP POLICY IF EXISTS "Auth update audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Auth delete audit_log" ON public.audit_log;
