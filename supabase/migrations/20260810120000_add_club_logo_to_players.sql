-- Par Équipe: club logo, at the tournament/player level.
--
-- `matches.club_logos` (from 20260805010000_add_club_logos.sql) already
-- lets a single running match carry a club logo, entered directly in
-- Admin. But a team set up in Tournament Manager (bracket or league) had
-- nowhere to store one — `players.team_logo` covers the team's own
-- (prominent) logo, but there was no equivalent for the smaller secondary
-- club badge, so starting a match from a tournament always left the club
-- logo blank even when the team had one on file.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS club_logo TEXT;

COMMENT ON COLUMN public.players.club_logo IS 'Par Équipe: secondary club/academy logo badge for a team entry, mirroring players.team_logo. Carried into matches.club_logos when a match is started from this team.';
