-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Participants can send messages" ON public.session_messages;

-- New policy: participants can only insert non-AI messages
CREATE POLICY "Participants can send non-AI messages"
ON public.session_messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND is_ai_message = false
  AND EXISTS (
    SELECT 1 FROM session_participants sp
    WHERE sp.session_id = session_messages.session_id
    AND sp.user_id = auth.uid()
    AND sp.is_active = true
  )
);