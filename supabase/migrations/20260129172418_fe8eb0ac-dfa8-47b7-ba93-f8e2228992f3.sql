-- Drop the existing INSERT policy for session_participants
DROP POLICY IF EXISTS "Users can join sessions" ON session_participants;

-- Create a better policy that validates group membership
CREATE POLICY "Group members can join sessions"
ON session_participants FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM study_sessions ss
    WHERE ss.id = session_participants.session_id
    AND (is_group_member(auth.uid(), ss.group_id) OR is_group_admin(auth.uid(), ss.group_id))
  )
);