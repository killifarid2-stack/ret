
-- 1) Replace public write policies with authenticated-only writes on public tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clubs','matches','players','tournaments','match_events'] LOOP
    -- drop all existing policies on the table
    PERFORM 1;
    EXECUTE format('DO $inner$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname=''public'' AND tablename=%L LOOP EXECUTE format(''DROP POLICY IF EXISTS %%I ON public.%%I'', p.policyname, %L); END LOOP; END $inner$;', t, t);
  END LOOP;
END $$;

-- Public read + authenticated write policies
CREATE POLICY "Public read clubs" ON public.clubs FOR SELECT USING (true);
CREATE POLICY "Auth insert clubs" ON public.clubs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update clubs" ON public.clubs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete clubs" ON public.clubs FOR DELETE TO authenticated USING (true);

CREATE POLICY "Public read matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Auth insert matches" ON public.matches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update matches" ON public.matches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete matches" ON public.matches FOR DELETE TO authenticated USING (true);

CREATE POLICY "Public read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Auth insert players" ON public.players FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update players" ON public.players FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete players" ON public.players FOR DELETE TO authenticated USING (true);

CREATE POLICY "Public read tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Auth insert tournaments" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update tournaments" ON public.tournaments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete tournaments" ON public.tournaments FOR DELETE TO authenticated USING (true);

CREATE POLICY "Public read match_events" ON public.match_events FOR SELECT USING (true);
CREATE POLICY "Auth insert match_events" ON public.match_events FOR INSERT TO authenticated WITH CHECK (true);

-- Grants: keep anon read (scoreboard), give writes to authenticated
REVOKE INSERT, UPDATE, DELETE ON public.clubs, public.matches, public.players, public.tournaments, public.match_events FROM anon;
GRANT SELECT ON public.clubs, public.matches, public.players, public.tournaments, public.match_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs, public.matches, public.players, public.tournaments TO authenticated;
GRANT SELECT, INSERT ON public.match_events TO authenticated;
GRANT ALL ON public.clubs, public.matches, public.players, public.tournaments, public.match_events TO service_role;

-- 2) Hide from GraphQL (app uses REST/PostgREST only)
REVOKE USAGE ON SCHEMA graphql FROM anon, authenticated;

-- 3) Realtime: require authenticated to subscribe to channels
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated realtime read" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated realtime write" ON realtime.messages;
CREATE POLICY "Authenticated realtime read" ON realtime.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated realtime write" ON realtime.messages FOR INSERT TO authenticated WITH CHECK (true);
