-- Create user_settings table for personalization
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  student_type TEXT CHECK (student_type IN ('art', 'science', 'commercial')),
  field_of_study TEXT,
  country TEXT,
  university_level TEXT CHECK (university_level IN ('100L', '200L', '300L', '400L', '500L', '600L')),
  ai_personality TEXT[] DEFAULT ARRAY['friendly']::TEXT[],
  courses TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_name TEXT,
  quiz_score_percentage INTEGER DEFAULT 0,
  total_quizzes_taken INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own settings"
ON public.user_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
ON public.user_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON public.user_settings
FOR UPDATE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();