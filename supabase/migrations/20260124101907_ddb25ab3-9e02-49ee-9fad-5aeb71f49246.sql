-- Fix user_settings security: Remove public SELECT, restrict to owner only
-- Also add unique constraint on session_participants for upsert to work

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Settings are publicly viewable" ON public.user_settings;

-- Create a new policy that only allows users to view their own settings
CREATE POLICY "Users can view their own settings" 
ON public.user_settings 
FOR SELECT 
USING (auth.uid() = user_id);

-- Add unique constraint on session_participants for upsert
ALTER TABLE public.session_participants 
ADD CONSTRAINT unique_session_user UNIQUE (session_id, user_id);

-- Add correct_answer column to session_quiz_responses if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_quiz_responses' AND column_name = 'correct_answer') THEN
    ALTER TABLE public.session_quiz_responses ADD COLUMN correct_answer TEXT;
  END IF;
END $$;