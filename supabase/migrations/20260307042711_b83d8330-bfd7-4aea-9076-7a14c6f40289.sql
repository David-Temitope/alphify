
-- Add mode column to conversations for lecture/assignment tracking
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS mode text DEFAULT null;

-- Add extracted_text column to uploaded_files for caching extracted content
ALTER TABLE public.uploaded_files ADD COLUMN IF NOT EXISTS extracted_text text DEFAULT null;
