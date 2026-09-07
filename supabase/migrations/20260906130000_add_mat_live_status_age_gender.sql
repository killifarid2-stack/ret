-- mat_live_status never carried age_group/gender, so any broadcast screen
-- showing ANOTHER mat's heartbeat (not its own locally-authored match state)
-- could never display that mat's age group / gender — the UI already had
-- cells for both (see MatBroadcastScreen.tsx), they were just always blank
-- for every mat except the one physically running that browser tab.
ALTER TABLE public.mat_live_status ADD COLUMN IF NOT EXISTS age_group TEXT;
ALTER TABLE public.mat_live_status ADD COLUMN IF NOT EXISTS gender TEXT;
