
-- Add notification preference columns to user_settings
ALTER TABLE public.user_settings 
  ADD COLUMN IF NOT EXISTS notify_mate_requests boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_mate_messages boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_library_uploads boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_study_sessions boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_daily_mastery boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_studied_topic text DEFAULT null;

-- Create a leaderboard function that returns users in the same field of study
CREATE OR REPLACE FUNCTION public.get_leaderboard(_field_of_study text)
RETURNS TABLE(
  user_id uuid,
  preferred_name text,
  star_rating numeric,
  total_quizzes_taken integer,
  quiz_score_percentage integer,
  field_of_study text,
  university text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    us.user_id,
    us.preferred_name,
    COALESCE(us.star_rating, 0) as star_rating,
    COALESCE(us.total_quizzes_taken, 0) as total_quizzes_taken,
    COALESCE(us.quiz_score_percentage, 0) as quiz_score_percentage,
    us.field_of_study,
    us.university
  FROM user_settings us
  WHERE us.field_of_study = _field_of_study
    AND auth.uid() IS NOT NULL
  ORDER BY us.star_rating DESC NULLS LAST, us.quiz_score_percentage DESC NULLS LAST
  LIMIT 50;
$$;

-- Create a function to get recommended mates based on same university/department
CREATE OR REPLACE FUNCTION public.get_recommended_mates(_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  preferred_name text,
  field_of_study text,
  university text,
  star_rating numeric,
  match_score integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH my_settings AS (
    SELECT university, field_of_study, university_level, courses
    FROM user_settings
    WHERE user_id = _user_id
    LIMIT 1
  )
  SELECT 
    us.user_id,
    us.preferred_name,
    us.field_of_study,
    us.university,
    COALESCE(us.star_rating, 0) as star_rating,
    (
      CASE WHEN us.university = ms.university THEN 3 ELSE 0 END +
      CASE WHEN us.field_of_study = ms.field_of_study THEN 2 ELSE 0 END +
      CASE WHEN us.university_level = ms.university_level THEN 1 ELSE 0 END
    )::integer as match_score
  FROM user_settings us, my_settings ms
  WHERE us.user_id != _user_id
    AND auth.uid() IS NOT NULL
    AND (us.university = ms.university OR us.field_of_study = ms.field_of_study)
  ORDER BY match_score DESC, us.star_rating DESC NULLS LAST
  LIMIT 20;
$$;
