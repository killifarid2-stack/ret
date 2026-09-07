-- Team logo and club logo are now two distinct images (e.g. a team's own
-- crest vs. the academy/club it competes under) instead of one shared
-- "team/club logo" field.
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS club_logos JSONB;

COMMENT ON COLUMN public.matches.club_logos IS 'Par Équipe: { chung?: string, hong?: string } — the CLUB/academy logo, shown as a smaller secondary badge next to the team''s own (larger, more prominent) logo on the team-call animation.';
