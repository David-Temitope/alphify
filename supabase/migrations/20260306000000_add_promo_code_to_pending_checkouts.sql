
-- Add promo_code to pending_checkouts and update default expiry
ALTER TABLE public.pending_checkouts ADD COLUMN promo_code TEXT;

ALTER TABLE public.pending_checkouts ALTER COLUMN expires_at SET DEFAULT (now() + interval '15 minutes');
