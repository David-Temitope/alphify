-- Fix overly permissive RLS policy on group_warnings
-- Drop the permissive policy and replace with a more secure one
DROP POLICY IF EXISTS "System can create warnings" ON public.group_warnings;

-- Only allow warnings to be created by session participants (via edge function with service role)
-- For now, allow group admins to create warnings
CREATE POLICY "Group admins can create warnings" ON public.group_warnings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_groups
      WHERE study_groups.id = group_warnings.group_id
      AND study_groups.admin_id = auth.uid()
    )
  );