-- Par Équipe: team logos, kept as a separate concept from any individual
-- player photo.
--
-- `matches.team_logos` mirrors the existing `team_names` JSONB column and
-- holds the two team logos shown on the operator/public screens for the
-- currently running match: { "chung": "<url-or-dataurl>", "hong": "..." }.
--
-- `players.team_logo` holds the logo for a Par Équipe "team" entry (in that
-- mode each row in `players` represents one team, its `name` is the team
-- name) — separate from the pre-existing `players.photo` column, which is
-- used for individual competitor photos in every other competition mode.
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS team_logos JSONB;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS team_logo TEXT;
