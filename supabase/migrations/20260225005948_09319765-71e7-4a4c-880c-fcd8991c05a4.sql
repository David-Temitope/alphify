-- Create mate_messages table for study mate direct messages
CREATE TABLE public.mate_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mate_messages ENABLE ROW LEVEL SECURITY;

-- Users can send messages to their study mates only
CREATE POLICY "Users can send messages to mates"
  ON public.mate_messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND are_study_mates(auth.uid(), receiver_id));

-- Users can view messages they sent or received
CREATE POLICY "Users can view their messages"
  ON public.mate_messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can delete their own sent messages
CREATE POLICY "Users can delete their own messages"
  ON public.mate_messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- Enable realtime for mate messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.mate_messages;