-- Allow group admins to add members to sessions and update their status
DROP POLICY IF EXISTS "Users can join sessions" ON public.session_participants;
CREATE POLICY "Users can join sessions" ON public.session_participants
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.study_sessions ss
      WHERE ss.id = session_id
      AND public.is_group_admin(auth.uid(), ss.group_id)
    )
  );

DROP POLICY IF EXISTS "Users can update their participation" ON public.session_participants;
CREATE POLICY "Users can update their participation" ON public.session_participants
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.study_sessions ss
      WHERE ss.id = session_id
      AND public.is_group_admin(auth.uid(), ss.group_id)
    )
  );
