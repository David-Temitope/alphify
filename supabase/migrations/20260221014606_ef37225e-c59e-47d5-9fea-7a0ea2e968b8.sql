
-- Create group_messages table for group chat
CREATE TABLE public.group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- Group members can view messages
CREATE POLICY "Group members can view group messages"
ON public.group_messages
FOR SELECT
USING (is_group_member(auth.uid(), group_id) OR is_group_admin(auth.uid(), group_id));

-- Group members can send messages
CREATE POLICY "Group members can send messages"
ON public.group_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (is_group_member(auth.uid(), group_id) OR is_group_admin(auth.uid(), group_id))
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

-- Add index for fast lookups
CREATE INDEX idx_group_messages_group_id ON public.group_messages(group_id, created_at);
