-- Mark stale pending checkouts as expired (older than 2 hours)
UPDATE public.pending_checkouts 
SET status = 'expired', updated_at = now()
WHERE status = 'pending' 
AND expires_at < now();

-- Create a function to auto-expire stale checkouts
CREATE OR REPLACE FUNCTION public.expire_stale_checkouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE pending_checkouts 
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending' 
  AND expires_at < now();
END;
$$;