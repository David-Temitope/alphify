-- Create a SECURITY DEFINER function to check if user is a session participant
CREATE OR REPLACE FUNCTION public.is_session_participant(_user_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM session_participants
    WHERE user_id = _user_id AND session_id = _session_id
  )
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Group members can view session participants" ON session_participants;
DROP POLICY IF EXISTS "Participants can view session messages" ON session_messages;
DROP POLICY IF EXISTS "Participants can send messages" ON session_messages;

-- Recreate session_participants SELECT policy without recursion
CREATE POLICY "Group members can view session participants"
ON session_participants FOR SELECT
USING (
  auth.uid() = user_id 
  OR is_session_participant(auth.uid(), session_id)
  OR EXISTS (
    SELECT 1 FROM study_sessions ss
    WHERE ss.id = session_participants.session_id
    AND (is_group_member(auth.uid(), ss.group_id) OR is_group_admin(auth.uid(), ss.group_id))
  )
);

-- Recreate session_messages SELECT policy without recursion  
CREATE POLICY "Participants can view session messages"
ON session_messages FOR SELECT
USING (
  is_session_participant(auth.uid(), session_id)
  OR is_ai_message = true
);

-- Recreate session_messages INSERT policy without recursion
CREATE POLICY "Participants can send messages"
ON session_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM session_participants sp
    WHERE sp.session_id = session_messages.session_id 
    AND sp.user_id = auth.uid() 
    AND sp.is_active = true
  )
);