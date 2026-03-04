
-- Add extracted_text and last_topic to uploaded_files for caching and nudges
ALTER TABLE public.uploaded_files ADD COLUMN IF NOT EXISTS extracted_text TEXT;
ALTER TABLE public.uploaded_files ADD COLUMN IF NOT EXISTS last_topic TEXT;

-- Add tracking for nudges and study history to user_settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS last_studied_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS last_studied_file_id UUID REFERENCES public.uploaded_files(id) ON DELETE SET NULL;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS last_studied_topic TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Add mode to conversations to distinguish Lecture Mode sessions
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'general';

-- Update RLS for uploaded_files to ensure users can update their own files (for caching)
-- (Existing policy should already cover this, but being explicit)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'uploaded_files'
        AND policyname = 'Users can update their own files'
    ) THEN
        CREATE POLICY "Users can update their own files" ON public.uploaded_files
        FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;
