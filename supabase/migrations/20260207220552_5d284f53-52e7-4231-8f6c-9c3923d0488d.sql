-- Add course-specific exam samples and exam mode tables

-- 1. Create table for course-specific exam samples
CREATE TABLE public.exam_samples (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course TEXT NOT NULL,
  file_id UUID REFERENCES public.uploaded_files(id) ON DELETE SET NULL,
  sample_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, course)
);

ALTER TABLE public.exam_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own exam samples" ON public.exam_samples
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_exam_samples_updated_at
  BEFORE UPDATE ON public.exam_samples
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Create table for exam attempts (Exam Mode)
CREATE TABLE public.exam_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course TEXT NOT NULL,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('objective', 'theory', 'both')),
  questions JSONB NOT NULL DEFAULT '[]',
  answers JSONB NOT NULL DEFAULT '[]',
  score INTEGER,
  max_score INTEGER NOT NULL DEFAULT 50,
  time_limit_minutes INTEGER NOT NULL DEFAULT 60,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own exam attempts" ON public.exam_attempts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Add scheduled_deletion column to mark accounts for deletion
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 4. Create storage policies for user-files bucket so users can upload exam samples
INSERT INTO storage.objects (bucket_id, name, owner, created_at, updated_at)
SELECT 'user-files', '.keep', auth.uid(), now(), now()
WHERE NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'user-files' LIMIT 1);

-- Drop if exists and recreate policies
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

CREATE POLICY "Users can upload their own files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'user-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'user-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'user-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );