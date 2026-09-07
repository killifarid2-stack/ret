-- Lets an organizer save a tournament's format/age-group/gender/weight/
-- substitution settings as a reusable named template, and load it back
-- later — from any device, since this is persisted in Supabase rather than
-- localStorage.
CREATE TABLE IF NOT EXISTS public.tournament_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  format TEXT,              -- knockout/friendly/league/par_equipe
  age_group TEXT,
  gender TEXT,
  weight_category TEXT,
  substitution_mode TEXT,   -- Par Équipe: 'rotation' or 'substitution' (teamPlayMode)
  extra JSONB,              -- any additional fields future versions may need
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tournament_templates ENABLE ROW LEVEL SECURITY;

-- Matches this project's existing convention (see the
-- 20260702163137_... migration): public read, authenticated write.
DROP POLICY IF EXISTS "Public read tournament_templates" ON public.tournament_templates;
DROP POLICY IF EXISTS "Auth insert tournament_templates" ON public.tournament_templates;
DROP POLICY IF EXISTS "Auth update tournament_templates" ON public.tournament_templates;
DROP POLICY IF EXISTS "Auth delete tournament_templates" ON public.tournament_templates;

CREATE POLICY "Public read tournament_templates" ON public.tournament_templates FOR SELECT USING (true);
CREATE POLICY "Auth insert tournament_templates" ON public.tournament_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update tournament_templates" ON public.tournament_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete tournament_templates" ON public.tournament_templates FOR DELETE TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.tournament_templates FROM anon;
GRANT SELECT ON public.tournament_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_templates TO authenticated;
GRANT ALL ON public.tournament_templates TO service_role;
