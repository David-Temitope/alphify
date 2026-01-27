-- 1. Ensure all current admins are members of their groups
-- This is necessary to break the recursion in RLS policies
INSERT INTO public.study_group_members (group_id, user_id)
SELECT id, admin_id
FROM public.study_groups
ON CONFLICT (group_id, user_id) DO NOTHING;

-- 2. Fix the mutual recursion between study_groups and study_group_members
-- Drop the problematic policies
DROP POLICY IF EXISTS "Group members and admins can view study groups" ON public.study_groups;
DROP POLICY IF EXISTS "Group members can view other members" ON public.study_group_members;

-- New study_groups policy: Break recursion by only checking admin_id or membership
-- The membership check will trigger study_group_members RLS, which we will simplify
CREATE POLICY "Group members and admins can view study groups"
ON public.study_groups
FOR SELECT
USING (
  auth.uid() = admin_id OR
  EXISTS (
    SELECT 1 FROM public.study_group_members
    WHERE public.study_group_members.group_id = id
    AND public.study_group_members.user_id = auth.uid()
  )
);

-- New study_group_members policy: ONLY depends on study_group_members table
-- This breaks the cycle because it no longer queries study_groups
CREATE POLICY "Group members can view other members"
ON public.study_group_members
FOR SELECT
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.study_group_members AS sgm
    WHERE sgm.group_id = study_group_members.group_id
    AND sgm.user_id = auth.uid()
  )
);

-- 3. Fix session_participants recursion if any
DROP POLICY IF EXISTS "Group members can view session participants" ON public.session_participants;

-- Simplified session_participants policy that avoids joining study_groups where possible
CREATE POLICY "Group members can view session participants"
ON public.session_participants
FOR SELECT
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.session_participants AS sp
    WHERE sp.session_id = session_participants.session_id
    AND sp.user_id = auth.uid()
  ) OR
  -- Check group membership via study_sessions table
  EXISTS (
    SELECT 1 FROM public.study_sessions ss
    JOIN public.study_group_members sgm ON sgm.group_id = ss.group_id
    WHERE ss.id = session_participants.session_id
    AND sgm.user_id = auth.uid()
  )
);
