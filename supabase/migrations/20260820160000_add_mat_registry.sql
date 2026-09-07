-- CENTRAL MAT REGISTRY
-- One row per physical mat. This is control state, separate from live match data.
CREATE TABLE IF NOT EXISTS public.mat_registry (
  mat_number INTEGER PRIMARY KEY,
  device_name TEXT,
  online BOOLEAN NOT NULL DEFAULT false,
  locked BOOLEAN NOT NULL DEFAULT false,
  lock_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mat_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read mat_registry" ON public.mat_registry;
DROP POLICY IF EXISTS "Auth write mat_registry" ON public.mat_registry;
CREATE POLICY "Public read mat_registry" ON public.mat_registry FOR SELECT USING (true);
CREATE POLICY "Auth write mat_registry" ON public.mat_registry FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE INSERT, UPDATE, DELETE ON public.mat_registry FROM anon;
GRANT SELECT ON public.mat_registry TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_registry TO authenticated;
GRANT ALL ON public.mat_registry TO service_role;
CREATE INDEX IF NOT EXISTS idx_mat_registry_updated_at ON public.mat_registry(updated_at DESC);
