-- User feedback/review system
CREATE TABLE public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  feedback TEXT NOT NULL,
  rating INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON public.user_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own feedback"
  ON public.user_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Add feedback_submitted flag to user_settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS feedback_submitted BOOLEAN DEFAULT false;

-- Auto-delete ended study sessions (trigger)
CREATE OR REPLACE FUNCTION public.auto_delete_ended_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'ended' THEN
    -- Delete session messages first
    DELETE FROM session_messages WHERE session_id = NEW.id;
    -- Delete participants
    DELETE FROM session_participants WHERE session_id = NEW.id;
    -- Delete quiz responses
    DELETE FROM session_quiz_responses WHERE session_id = NEW.id;
    -- Delete the session itself
    DELETE FROM study_sessions WHERE id = NEW.id;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_delete_ended_sessions
  AFTER UPDATE OF status ON public.study_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'ended')
  EXECUTE FUNCTION public.auto_delete_ended_sessions();