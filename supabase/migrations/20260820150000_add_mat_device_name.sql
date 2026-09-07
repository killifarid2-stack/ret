-- MULTI-MAT DEVICE IDENTITY
-- Each physical operator computer can be assigned a MAT number locally.
-- The live heartbeat also publishes a friendly device name so a central
-- Control Room can immediately see which PC is serving each mat.
ALTER TABLE public.mat_live_status ADD COLUMN IF NOT EXISTS device_name TEXT;
CREATE INDEX IF NOT EXISTS idx_mat_live_status_device_name ON public.mat_live_status (device_name);
