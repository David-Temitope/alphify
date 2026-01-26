-- Phase 3: Add exam sample columns to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS exam_sample_text TEXT,
ADD COLUMN IF NOT EXISTS exam_sample_file_id UUID REFERENCES public.uploaded_files(id);

-- Phase 6: Add unique constraint to prevent duplicate study_mates (using DO block to check if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_mate_pair'
  ) THEN
    ALTER TABLE public.study_mates ADD CONSTRAINT unique_mate_pair UNIQUE (user_id, mate_id);
  END IF;
END $$;

-- Phase 10: Drop the old view that uses security_invoker (which doesn't work with RLS)
DROP VIEW IF EXISTS public.user_public_profiles;

-- Create a SECURITY DEFINER function to fetch public profiles (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_public_profiles()
RETURNS TABLE (user_id uuid, field_of_study text, star_rating numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, field_of_study, star_rating
  FROM user_settings;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO authenticated;