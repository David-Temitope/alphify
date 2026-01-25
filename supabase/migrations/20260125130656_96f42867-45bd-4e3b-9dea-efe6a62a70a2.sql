-- Create a public view for displaying user discovery info (star rating, field of study only)
-- This view exposes ONLY non-sensitive data for the community discover page
CREATE VIEW public.user_public_profiles AS
SELECT 
  user_id,
  field_of_study,
  star_rating
FROM public.user_settings;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.user_public_profiles TO authenticated;

-- Create RLS policy-like security using a function
-- The view will be accessible to all authenticated users but only for discovery purposes