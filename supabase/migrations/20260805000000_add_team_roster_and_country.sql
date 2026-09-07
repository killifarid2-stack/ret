-- Admin can now enter/save full Par Équipe (team mode) settings directly —
-- team identity, roster, country — without leaving the Admin screen. Two
-- columns were still missing to actually persist that from a single-match
-- Admin save (team_names/team_logos already existed from an earlier
-- migration, but nothing stored the roster itself, or which country each
-- team represents):
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS team_roster JSONB;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS team_country JSONB;

COMMENT ON COLUMN public.matches.team_roster IS 'Par Équipe: { chung: RosterPlayer[], hong: RosterPlayer[] } snapshot at save time — lets a match be fully restored (players, numbers, photos) without re-entering anything.';
COMMENT ON COLUMN public.matches.team_country IS 'Par Équipe: { chung?: string, hong?: string } — the country each team represents, shown with its flag on the team-call animation.';
