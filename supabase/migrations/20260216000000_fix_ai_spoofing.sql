
-- Prevent spoofing of AI messages in study sessions
-- This policy ensures that authenticated users can only insert messages where is_ai_message is false.
-- AI messages (is_ai_message = true) must be inserted via a service role (e.g. from an Edge Function).
DROP POLICY IF EXISTS "Participants can send messages" ON public.session_messages;
CREATE POLICY "Participants can send messages"
ON session_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (is_ai_message = false OR is_ai_message IS NULL)
  AND EXISTS (
    SELECT 1 FROM session_participants sp
    WHERE sp.session_id = session_messages.session_id
    AND sp.user_id = auth.uid()
    AND sp.is_active = true
  )
);
