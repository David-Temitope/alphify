
-- Table to track payment attempts before Paystack confirmation
CREATE TABLE public.pending_checkouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  package_type TEXT,
  custom_units INTEGER,
  units INTEGER NOT NULL,
  expected_amount INTEGER NOT NULL,
  target TEXT NOT NULL DEFAULT 'personal',
  group_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '2 hours')
);

-- Enable RLS
ALTER TABLE public.pending_checkouts ENABLE ROW LEVEL SECURITY;

-- Users can view their own pending checkouts
CREATE POLICY "Users can view their own pending checkouts"
  ON public.pending_checkouts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own pending checkouts
CREATE POLICY "Users can insert their own pending checkouts"
  ON public.pending_checkouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending checkouts
CREATE POLICY "Users can update their own pending checkouts"
  ON public.pending_checkouts FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_pending_checkouts_updated_at
  BEFORE UPDATE ON public.pending_checkouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
