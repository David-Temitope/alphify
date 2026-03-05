
-- Add new columns to promo_codes for subaccount split, bonus KU, and expiry
ALTER TABLE public.promo_codes 
  ADD COLUMN IF NOT EXISTS subaccount_code TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bonus_ku INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.promo_codes.subaccount_code IS 'Paystack subaccount code (ACCT_xxxxx) for split payments';
COMMENT ON COLUMN public.promo_codes.bonus_ku IS 'Extra free KU granted to users who use this promo code';
COMMENT ON COLUMN public.promo_codes.expires_at IS 'Optional expiry date for the promo code';
