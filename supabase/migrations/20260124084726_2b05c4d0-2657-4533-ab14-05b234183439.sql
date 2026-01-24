-- Study Sessions table
CREATE TABLE public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  course TEXT NOT NULL,
  topic TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'scheduled',
  started_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Session Participants tracking
CREATE TABLE public.session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(session_id, user_id)
);

-- Session Messages (for group chat during sessions)
CREATE TABLE public.session_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_ai_message BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Session Quiz Responses
CREATE TABLE public.session_quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  quiz_question TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  correct_answer TEXT,
  is_correct BOOLEAN,
  points_earned NUMERIC DEFAULT 0,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Group warnings for off-topic discussions
CREATE TABLE public.group_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.study_sessions(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  warned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add suspension columns to study_groups
ALTER TABLE public.study_groups ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.study_groups ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0;

-- Enable RLS on all new tables
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_quiz_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_warnings ENABLE ROW LEVEL SECURITY;

-- Study Sessions policies
CREATE POLICY "Group members can view sessions" ON public.study_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.study_group_members
      WHERE study_group_members.group_id = study_sessions.group_id
      AND study_group_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.study_groups
      WHERE study_groups.id = study_sessions.group_id
      AND study_groups.admin_id = auth.uid()
    )
  );

CREATE POLICY "Group admins can create sessions" ON public.study_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_groups
      WHERE study_groups.id = group_id
      AND study_groups.admin_id = auth.uid()
    )
    AND auth.uid() = created_by
  );

CREATE POLICY "Session creators can update sessions" ON public.study_sessions
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Session creators can delete sessions" ON public.study_sessions
  FOR DELETE USING (auth.uid() = created_by);

-- Session Participants policies
CREATE POLICY "Anyone can view session participants" ON public.session_participants
  FOR SELECT USING (true);

CREATE POLICY "Users can join sessions" ON public.session_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave sessions" ON public.session_participants
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can update their participation" ON public.session_participants
  FOR UPDATE USING (auth.uid() = user_id);

-- Session Messages policies
CREATE POLICY "Participants can view session messages" ON public.session_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.session_participants
      WHERE session_participants.session_id = session_messages.session_id
      AND session_participants.user_id = auth.uid()
    )
    OR is_ai_message = true
  );

CREATE POLICY "Participants can send messages" ON public.session_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.session_participants
      WHERE session_participants.session_id = session_messages.session_id
      AND session_participants.user_id = auth.uid()
      AND session_participants.is_active = true
    )
  );

-- Session Quiz Responses policies
CREATE POLICY "Users can view their own quiz responses" ON public.session_quiz_responses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can submit quiz responses" ON public.session_quiz_responses
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.session_participants
      WHERE session_participants.session_id = session_quiz_responses.session_id
      AND session_participants.user_id = auth.uid()
    )
  );

-- Group Warnings policies
CREATE POLICY "Group admins can view warnings" ON public.group_warnings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.study_groups
      WHERE study_groups.id = group_warnings.group_id
      AND study_groups.admin_id = auth.uid()
    )
  );

CREATE POLICY "System can create warnings" ON public.group_warnings
  FOR INSERT WITH CHECK (true);

-- Enable realtime for session messages and participants
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;