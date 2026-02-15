
-- 1. Add university column to user_settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS university text;

-- 2. Create department_admins table
CREATE TABLE public.department_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  university text NOT NULL,
  department text NOT NULL,
  level text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.department_admins ENABLE ROW LEVEL SECURITY;

-- Users can only view their own admin assignments
CREATE POLICY "Users can view their own admin assignments"
  ON public.department_admins FOR SELECT
  USING (auth.uid() = user_id);

-- 3. Create shared_files table
CREATE TABLE public.shared_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by uuid NOT NULL,
  university text NOT NULL,
  department text NOT NULL,
  level text NOT NULL,
  course_code text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  extracted_text text,
  file_category text NOT NULL DEFAULT 'course_material',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_files ENABLE ROW LEVEL SECURITY;

-- 4. Security definer functions to avoid RLS recursion

-- Check if a user is a department admin for a given university/department/level
CREATE OR REPLACE FUNCTION public.is_department_admin(_user_id uuid, _university text, _department text, _level text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM department_admins
    WHERE user_id = _user_id
      AND university = _university
      AND department = _department
      AND level = _level
  )
$$;

-- Check if a user is ANY department admin (for UI purposes)
CREATE OR REPLACE FUNCTION public.is_any_department_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM department_admins
    WHERE user_id = _user_id
  )
$$;

-- Check if a user's settings match a shared file's target audience
CREATE OR REPLACE FUNCTION public.user_matches_shared_file(_user_id uuid, _university text, _department text, _level text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_settings
    WHERE user_id = _user_id
      AND university = _university
      AND field_of_study = _department
      AND university_level = _level
  )
$$;

-- Get user's department admin assignments
CREATE OR REPLACE FUNCTION public.get_admin_assignments(_user_id uuid)
RETURNS TABLE(university text, department text, level text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT da.university, da.department, da.level
  FROM department_admins da
  WHERE da.user_id = _user_id
$$;

-- 5. RLS policies for shared_files

-- SELECT: Users whose settings match OR who are admins for the file's target
CREATE POLICY "Users can view matching shared files"
  ON public.shared_files FOR SELECT
  USING (
    user_matches_shared_file(auth.uid(), university, department, level)
    OR is_department_admin(auth.uid(), university, department, level)
  );

-- INSERT: Only department admins for the matching target
CREATE POLICY "Admins can upload shared files"
  ON public.shared_files FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by
    AND is_department_admin(auth.uid(), university, department, level)
  );

-- DELETE: Only the uploader
CREATE POLICY "Uploaders can delete their shared files"
  ON public.shared_files FOR DELETE
  USING (auth.uid() = uploaded_by);

-- UPDATE: Only the uploader (for caching extracted_text)
CREATE POLICY "Uploaders can update their shared files"
  ON public.shared_files FOR UPDATE
  USING (auth.uid() = uploaded_by);

-- 6. Storage policies for shared files in user-files bucket
-- Allow admins to upload to shared/ paths
CREATE POLICY "Admins can upload shared files to storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = 'shared'
    AND auth.uid() IS NOT NULL
  );

-- Allow authenticated users to download shared files
CREATE POLICY "Authenticated users can download shared files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = 'shared'
    AND auth.uid() IS NOT NULL
  );

-- Allow admins to delete their shared files from storage
CREATE POLICY "Admins can delete shared files from storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = 'shared'
    AND auth.uid() IS NOT NULL
  );
