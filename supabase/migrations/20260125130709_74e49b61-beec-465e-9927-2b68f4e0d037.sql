-- Fix: Recreate view with security_invoker=on (not security_definer)
DROP VIEW IF EXISTS public.user_public_profiles;

CREATE VIEW public.user_public_profiles
WITH (security_invoker=on) AS
SELECT 
  user_id,
  field_of_study,
  star_rating
FROM public.user_settings;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.user_public_profiles TO authenticated;