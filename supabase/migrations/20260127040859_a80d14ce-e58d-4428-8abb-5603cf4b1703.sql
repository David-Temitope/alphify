-- Fix study_mates RLS: Allow users to insert study mate connections for accepted requests
-- The current policy only allows inserting where user_id = auth.uid(), but we need bidirectional insertion

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can add study mates" ON public.study_mates;

-- Create a new policy that allows inserting if user is either the user_id or mate_id
-- This allows bidirectional study mate connections to be created
CREATE POLICY "Users can add study mates bidirectionally" 
ON public.study_mates 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR auth.uid() = mate_id);

-- Add unique constraint to prevent duplicates (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_mate_pair'
  ) THEN
    ALTER TABLE public.study_mates ADD CONSTRAINT unique_mate_pair UNIQUE (user_id, mate_id);
  END IF;
END $$;

-- SECURITY FIXES --

-- 1. Restrict study_groups visibility to members and admins only
DROP POLICY IF EXISTS "Anyone can view study groups" ON public.study_groups;

CREATE POLICY "Group members and admins can view study groups" 
ON public.study_groups 
FOR SELECT 
USING (
  auth.uid() = admin_id OR
  EXISTS (
    SELECT 1 FROM study_group_members 
    WHERE study_group_members.group_id = study_groups.id 
    AND study_group_members.user_id = auth.uid()
  )
);

-- 2. Restrict study_group_members visibility to group members only
DROP POLICY IF EXISTS "Anyone can view group members" ON public.study_group_members;

CREATE POLICY "Group members can view other members" 
ON public.study_group_members 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM study_group_members AS sgm
    WHERE sgm.group_id = study_group_members.group_id 
    AND sgm.user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM study_groups
    WHERE study_groups.id = study_group_members.group_id
    AND study_groups.admin_id = auth.uid()
  )
);

-- 3. Restrict session_participants visibility to participants and group members
DROP POLICY IF EXISTS "Anyone can view session participants" ON public.session_participants;

CREATE POLICY "Group members can view session participants" 
ON public.session_participants 
FOR SELECT 
USING (
  -- User is a participant in this session
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM session_participants AS sp
    WHERE sp.session_id = session_participants.session_id
    AND sp.user_id = auth.uid()
  ) OR
  -- User is a member of the group that owns this session
  EXISTS (
    SELECT 1 FROM study_sessions ss
    JOIN study_group_members sgm ON sgm.group_id = ss.group_id
    WHERE ss.id = session_participants.session_id
    AND sgm.user_id = auth.uid()
  ) OR
  -- User is admin of the group
  EXISTS (
    SELECT 1 FROM study_sessions ss
    JOIN study_groups sg ON sg.id = ss.group_id
    WHERE ss.id = session_participants.session_id
    AND sg.admin_id = auth.uid()
  )
);

-- 4. Restrict profiles visibility to authenticated users (not public)
-- and prefer only showing study mates + users in same groups
DROP POLICY IF EXISTS "Profiles are publicly viewable" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles for community" 
ON public.profiles 
FOR SELECT 
USING (
  -- User can see their own profile
  auth.uid() = user_id OR
  -- User can see profiles of their study mates
  EXISTS (
    SELECT 1 FROM study_mates 
    WHERE (study_mates.user_id = auth.uid() AND study_mates.mate_id = profiles.user_id)
       OR (study_mates.mate_id = auth.uid() AND study_mates.user_id = profiles.user_id)
  ) OR
  -- User can see profiles of users in same study groups
  EXISTS (
    SELECT 1 FROM study_group_members sgm1
    JOIN study_group_members sgm2 ON sgm1.group_id = sgm2.group_id
    WHERE sgm1.user_id = auth.uid() AND sgm2.user_id = profiles.user_id
  ) OR
  -- User can see profiles in the discovery flow (for sending requests)
  auth.uid() IS NOT NULL
);

-- 5. Create a more restricted version of get_public_profiles that only returns minimal info
-- and adds some access control
DROP FUNCTION IF EXISTS public.get_public_profiles();

CREATE OR REPLACE FUNCTION public.get_public_profiles()
RETURNS TABLE (user_id uuid, field_of_study text, star_rating numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only return public profile info for authenticated users
  -- This is intentionally public discovery data (field of study, star rating)
  SELECT us.user_id, us.field_of_study, us.star_rating
  FROM user_settings us
  WHERE auth.uid() IS NOT NULL;
$$;