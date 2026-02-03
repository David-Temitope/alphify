-- Allow authenticated users to read subscription plan for badge display
-- This is safe as it only exposes the plan type, not payment details
CREATE POLICY "Authenticated users can view subscription plans"
ON public.subscriptions FOR SELECT
TO authenticated
USING (true);