-- WAB-TKD production security hardening.
--
-- Historical migrations contain broad policies for backwards compatibility.
-- This final migration replaces every writable app policy with a policy that
-- requires a REAL Supabase authenticated user (not an anonymous session) and
-- an app_metadata.role claim of REFEREE, SUPERVISOR, or ADMIN.
--
-- IMPORTANT: app_metadata is trusted JWT metadata and must be provisioned by
-- a trusted backend/service-role workflow. It must NOT be writable by the
-- browser. The public scoreboard keeps SELECT access where required.

CREATE OR REPLACE FUNCTION public.wab_has_app_role()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    auth.role() = 'authenticated'
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('REFEREE','SUPERVISOR','ADMIN');
$$;

-- Keep public scoreboard/archive reads, but never permit public writes.
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clubs','matches','players','tournaments','match_events',
    'tournament_templates','pool_player_stats','mat_live_status',
    'mat_match_queue','mat_registry','tournament_archive_nodes','audit_log'
  ] LOOP
    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname='public' AND tablename=t
        AND (cmd IN ('INSERT','UPDATE','DELETE') OR cmd='ALL')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- Explicit public SELECT policies where the application uses a public/read-only
-- scoreboard or archive browser. Existing SELECT policies are left intact.

CREATE POLICY "WAB strict insert clubs" ON public.clubs
  FOR INSERT TO authenticated WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict update clubs" ON public.clubs
  FOR UPDATE TO authenticated USING (public.wab_has_app_role()) WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict delete clubs" ON public.clubs
  FOR DELETE TO authenticated USING (public.wab_has_app_role());

CREATE POLICY "WAB strict insert players" ON public.players
  FOR INSERT TO authenticated WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict update players" ON public.players
  FOR UPDATE TO authenticated USING (public.wab_has_app_role()) WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict delete players" ON public.players
  FOR DELETE TO authenticated USING (public.wab_has_app_role());

CREATE POLICY "WAB strict insert tournaments" ON public.tournaments
  FOR INSERT TO authenticated WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict update tournaments" ON public.tournaments
  FOR UPDATE TO authenticated USING (public.wab_has_app_role()) WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict delete tournaments" ON public.tournaments
  FOR DELETE TO authenticated USING (public.wab_has_app_role());

CREATE POLICY "WAB strict insert matches" ON public.matches
  FOR INSERT TO authenticated WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict update matches" ON public.matches
  FOR UPDATE TO authenticated USING (public.wab_has_app_role()) WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict delete matches" ON public.matches
  FOR DELETE TO authenticated USING (public.wab_has_app_role());

CREATE POLICY "WAB strict insert match_events" ON public.match_events
  FOR INSERT TO authenticated WITH CHECK (public.wab_has_app_role());

CREATE POLICY "WAB strict insert tournament_templates" ON public.tournament_templates
  FOR INSERT TO authenticated WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict update tournament_templates" ON public.tournament_templates
  FOR UPDATE TO authenticated USING (public.wab_has_app_role()) WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict delete tournament_templates" ON public.tournament_templates
  FOR DELETE TO authenticated USING (public.wab_has_app_role());

CREATE POLICY "WAB strict insert pool_player_stats" ON public.pool_player_stats
  FOR INSERT TO authenticated WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict update pool_player_stats" ON public.pool_player_stats
  FOR UPDATE TO authenticated USING (public.wab_has_app_role()) WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict delete pool_player_stats" ON public.pool_player_stats
  FOR DELETE TO authenticated USING (public.wab_has_app_role());

CREATE POLICY "WAB strict insert mat_live_status" ON public.mat_live_status
  FOR INSERT TO authenticated WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict update mat_live_status" ON public.mat_live_status
  FOR UPDATE TO authenticated USING (public.wab_has_app_role()) WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict delete mat_live_status" ON public.mat_live_status
  FOR DELETE TO authenticated USING (public.wab_has_app_role());

CREATE POLICY "WAB strict all mat_match_queue" ON public.mat_match_queue
  FOR ALL TO authenticated USING (public.wab_has_app_role()) WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict all mat_registry" ON public.mat_registry
  FOR ALL TO authenticated USING (public.wab_has_app_role()) WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict all tournament_archive_nodes" ON public.tournament_archive_nodes
  FOR ALL TO authenticated USING (public.wab_has_app_role()) WITH CHECK (public.wab_has_app_role());
CREATE POLICY "WAB strict insert audit_log" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (public.wab_has_app_role());

-- Never let anon obtain DML privileges, even if an older migration granted them.
REVOKE INSERT, UPDATE, DELETE ON public.clubs, public.matches, public.players,
  public.tournaments, public.match_events, public.tournament_templates,
  public.pool_player_stats, public.mat_live_status, public.mat_match_queue,
  public.mat_registry, public.tournament_archive_nodes, public.audit_log FROM anon;

-- The browser can still read public scoreboard data.
GRANT SELECT ON public.clubs, public.matches, public.players, public.tournaments,
  public.match_events, public.mat_live_status, public.mat_match_queue,
  public.mat_registry, public.tournament_archive_nodes TO anon;
