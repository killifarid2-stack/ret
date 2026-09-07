-- The Admin/Tournament Manager screen lets the referee attach a photo,
-- bib/player number, and seed number to every athlete, but the `players`
-- table never had columns for them — only name/nationality/club/age_group/
-- gender/weight_category were persisted. As a result, whenever a tournament
-- was reloaded from the cloud (a non-local tournament id), the player list
-- was rebuilt straight from this table and silently lost every photo,
-- player number, and seed number that had been entered, even though the
-- tournament's own bracket_data snapshot still had them.
--
-- Add the missing columns so a full admin save (photo, player number, seed
-- number, club, nationality, gender, weight category) round-trips correctly
-- for players linked to a tournament.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS photo TEXT,
  ADD COLUMN IF NOT EXISTS player_number INTEGER,
  ADD COLUMN IF NOT EXISTS seed_number INTEGER;
