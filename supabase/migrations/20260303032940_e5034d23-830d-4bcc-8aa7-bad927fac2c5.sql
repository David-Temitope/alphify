-- Drop the stale check constraint that blocks new university level values
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_university_level_check;