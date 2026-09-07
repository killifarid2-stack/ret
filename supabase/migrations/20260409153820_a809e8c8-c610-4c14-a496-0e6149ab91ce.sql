
-- Players table
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  nationality TEXT DEFAULT '',
  club TEXT DEFAULT '',
  age_group TEXT DEFAULT 'senior',
  gender TEXT DEFAULT 'male',
  weight_category TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Public insert players" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update players" ON public.players FOR UPDATE USING (true);
CREATE POLICY "Public delete players" ON public.players FOR DELETE USING (true);

-- Clubs table
CREATE TABLE public.clubs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT DEFAULT '',
  gold INTEGER DEFAULT 0,
  silver INTEGER DEFAULT 0,
  bronze INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read clubs" ON public.clubs FOR SELECT USING (true);
CREATE POLICY "Public insert clubs" ON public.clubs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update clubs" ON public.clubs FOR UPDATE USING (true);
CREATE POLICY "Public delete clubs" ON public.clubs FOR DELETE USING (true);

-- Tournaments table
CREATE TABLE public.tournaments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT DEFAULT '',
  location TEXT DEFAULT '',
  format TEXT DEFAULT 'knockout',
  age_group TEXT DEFAULT 'senior',
  gender TEXT DEFAULT 'male',
  weight_category TEXT DEFAULT '',
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Public insert tournaments" ON public.tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update tournaments" ON public.tournaments FOR UPDATE USING (true);
CREATE POLICY "Public delete tournaments" ON public.tournaments FOR DELETE USING (true);

-- Matches table
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  match_number INTEGER DEFAULT 0,
  competition_name TEXT DEFAULT '',
  weight_category TEXT DEFAULT '',
  chung_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  hong_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  chung_name TEXT DEFAULT '',
  hong_name TEXT DEFAULT '',
  chung_nationality TEXT DEFAULT '',
  hong_nationality TEXT DEFAULT '',
  chung_score INTEGER DEFAULT 0,
  hong_score INTEGER DEFAULT 0,
  chung_gamjeom INTEGER DEFAULT 0,
  hong_gamjeom INTEGER DEFAULT 0,
  winner TEXT, -- 'chung' or 'hong'
  win_method TEXT, -- PTF, PTG, KO, DSQ, etc.
  rounds_data JSONB DEFAULT '[]',
  config JSONB DEFAULT '{}',
  status TEXT DEFAULT 'waiting',
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Public insert matches" ON public.matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update matches" ON public.matches FOR UPDATE USING (true);
CREATE POLICY "Public delete matches" ON public.matches FOR DELETE USING (true);

-- Match events log
CREATE TABLE public.match_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  player TEXT NOT NULL, -- 'chung' or 'hong'
  event_type TEXT NOT NULL, -- punch, trunk_kick, head_kick, etc.
  points INTEGER DEFAULT 0,
  time_remaining INTEGER DEFAULT 0,
  added_by TEXT DEFAULT 'operator',
  judge_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read match_events" ON public.match_events FOR SELECT USING (true);
CREATE POLICY "Public insert match_events" ON public.match_events FOR INSERT WITH CHECK (true);

-- Enable realtime for matches (scoreboard sync)
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
