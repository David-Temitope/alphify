-- Fix infinite recursion in RLS policies
-- The issue: profiles and study_group_members policies reference each other causing recursion

-- Step 1: Create security definer functions to avoid RLS recursion

-- Function to check if user is a member of a group (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM study_group_members
    WHERE user_id = _user_id AND group_id = _group_id
  )
$$;

-- Function to check if user is admin of a group (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM study_groups
    WHERE id = _group_id AND admin_id = _user_id
  )
$$;

-- Function to check if two users share a group
CREATE OR REPLACE FUNCTION public.users_share_group(_user_id1 uuid, _user_id2 uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM study_group_members sgm1
    JOIN study_group_members sgm2 ON sgm1.group_id = sgm2.group_id
    WHERE sgm1.user_id = _user_id1 AND sgm2.user_id = _user_id2
  )
$$;

-- Function to check if users are study mates
CREATE OR REPLACE FUNCTION public.are_study_mates(_user_id1 uuid, _user_id2 uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM study_mates
    WHERE (user_id = _user_id1 AND mate_id = _user_id2)
       OR (user_id = _user_id2 AND mate_id = _user_id1)
  )
$$;

-- Step 2: Drop and recreate policies using security definer functions

-- Fix profiles SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view profiles for community" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles for community"
ON public.profiles FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.are_study_mates(auth.uid(), user_id)
  OR public.users_share_group(auth.uid(), user_id)
  OR auth.uid() IS NOT NULL
);

-- Fix study_group_members SELECT policy
DROP POLICY IF EXISTS "Group members can view other members" ON public.study_group_members;
CREATE POLICY "Group members can view other members"
ON public.study_group_members FOR SELECT
USING (
  public.is_group_member(auth.uid(), group_id)
  OR public.is_group_admin(auth.uid(), group_id)
);

-- Fix study_groups SELECT policy
DROP POLICY IF EXISTS "Group members and admins can view study groups" ON public.study_groups;
CREATE POLICY "Group members and admins can view study groups"
ON public.study_groups FOR SELECT
USING (
  auth.uid() = admin_id
  OR public.is_group_member(auth.uid(), id)
);

-- Fix study_sessions SELECT policy
DROP POLICY IF EXISTS "Group members can view sessions" ON public.study_sessions;
CREATE POLICY "Group members can view sessions"
ON public.study_sessions FOR SELECT
USING (
  public.is_group_member(auth.uid(), group_id)
  OR public.is_group_admin(auth.uid(), group_id)
);

-- Fix session_participants SELECT policy
DROP POLICY IF EXISTS "Group members can view session participants" ON public.session_participants;
CREATE POLICY "Group members can view session participants"
ON public.session_participants FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM session_participants sp
    WHERE sp.session_id = session_participants.session_id AND sp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM study_sessions ss
    WHERE ss.id = session_participants.session_id
    AND (public.is_group_member(auth.uid(), ss.group_id) OR public.is_group_admin(auth.uid(), ss.group_id))
  )
);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.users_share_group(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_study_mates(uuid, uuid) TO authenticated;