
-- Add unique constraint to paystack_reference in payment_history table
-- This prevents duplicate transaction logging and ensures system integrity.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_paystack_reference'
    ) THEN
        ALTER TABLE public.payment_history
        ADD CONSTRAINT unique_paystack_reference UNIQUE (paystack_reference);
    END IF;
END $$;
