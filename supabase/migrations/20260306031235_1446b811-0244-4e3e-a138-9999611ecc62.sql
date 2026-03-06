-- Resolve RLS linter finding for promo_code_usage
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own promo code usage" ON public.promo_code_usage;
CREATE POLICY "Users can view their own promo code usage"
ON public.promo_code_usage
FOR SELECT
USING (auth.uid() = user_id);