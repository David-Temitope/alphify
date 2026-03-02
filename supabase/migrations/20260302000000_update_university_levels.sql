-- Update university_level values and constraint in user_settings
ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_university_level_check;

-- Update existing data to new format
UPDATE public.user_settings SET university_level = 'Year 1' WHERE university_level = '100L';
UPDATE public.user_settings SET university_level = 'Year 2' WHERE university_level = '200L';
UPDATE public.user_settings SET university_level = 'Year 3' WHERE university_level = '300L';
UPDATE public.user_settings SET university_level = 'Year 4' WHERE university_level = '400L';
UPDATE public.user_settings SET university_level = 'Year 5' WHERE university_level = '500L';
UPDATE public.user_settings SET university_level = 'Year 6' WHERE university_level = '600L';
UPDATE public.user_settings SET university_level = 'PGD' WHERE university_level = 'Postgraduate';

-- Add new constraint
ALTER TABLE public.user_settings
ADD CONSTRAINT user_settings_university_level_check
CHECK (university_level IN ('Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'PGD'));

-- Maintain consistency in other tables that store 'level'
UPDATE public.department_admins SET level = 'Year 1' WHERE level = '100L';
UPDATE public.department_admins SET level = 'Year 2' WHERE level = '200L';
UPDATE public.department_admins SET level = 'Year 3' WHERE level = '300L';
UPDATE public.department_admins SET level = 'Year 4' WHERE level = '400L';
UPDATE public.department_admins SET level = 'Year 5' WHERE level = '500L';
UPDATE public.department_admins SET level = 'Year 6' WHERE level = '600L';
UPDATE public.department_admins SET level = 'PGD' WHERE level = 'Postgraduate';

UPDATE public.shared_files SET level = 'Year 1' WHERE level = '100L';
UPDATE public.shared_files SET level = 'Year 2' WHERE level = '200L';
UPDATE public.shared_files SET level = 'Year 3' WHERE level = '300L';
UPDATE public.shared_files SET level = 'Year 4' WHERE level = '400L';
UPDATE public.shared_files SET level = 'Year 5' WHERE level = '500L';
UPDATE public.shared_files SET level = 'Year 6' WHERE level = '600L';
UPDATE public.shared_files SET level = 'PGD' WHERE level = 'Postgraduate';
