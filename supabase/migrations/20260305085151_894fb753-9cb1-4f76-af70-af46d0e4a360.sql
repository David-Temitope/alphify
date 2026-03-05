
-- Promo codes table for influencer marketing
CREATE TABLE public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  influencer_name TEXT NOT NULL,
  influencer_email TEXT,
  influencer_phone TEXT,
  commission_rate NUMERIC NOT NULL DEFAULT 0.10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_uses INTEGER NOT NULL DEFAULT 0,
  total_commission_naira NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Track each promo code usage per payment
CREATE TABLE public.promo_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  payment_reference TEXT NOT NULL,
  purchase_amount_kobo INTEGER NOT NULL,
  commission_amount_kobo INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active promo codes (to validate at checkout)
CREATE POLICY "Authenticated users can read active promo codes"
  ON public.promo_codes FOR SELECT TO authenticated
  USING (is_active = true);

-- Only service role inserts/updates promo_code_usage (done in edge function)
-- No public RLS policies needed for promo_code_usage

-- Index for fast code lookup
CREATE INDEX idx_promo_codes_code ON public.promo_codes (code);
CREATE INDEX idx_promo_code_usage_promo_code_id ON public.promo_code_usage (promo_code_id);
