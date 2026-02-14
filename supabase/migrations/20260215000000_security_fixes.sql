
-- Drop insecure policies
-- This policy incorrectly allowed users to update their own balance directly via the client
DROP POLICY IF EXISTS "System can manage wallets" ON public.ku_wallets;

-- This policy incorrectly allowed users to log their own transactions, which could be abused
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.ku_transactions;

-- Fix session_participants RLS to prevent unauthorized users from joining sessions
-- The previous policy only checked if the user joining was themselves, but not if they were in the group
DROP POLICY IF EXISTS "Users can join sessions" ON public.session_participants;
CREATE POLICY "Users can join sessions" ON public.session_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_sessions ss
      WHERE ss.id = session_id
      AND (
        -- User joining themselves must be a group member or admin
        (auth.uid() = user_id AND (public.is_group_member(auth.uid(), ss.group_id) OR public.is_group_admin(auth.uid(), ss.group_id)))
        -- Or a group admin adding someone else
        OR public.is_group_admin(auth.uid(), ss.group_id)
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their participation" ON public.session_participants;
CREATE POLICY "Users can update their participation" ON public.session_participants
  FOR UPDATE USING (
    -- Users can update their own status if they are in the group
    (auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.study_sessions ss
      WHERE ss.id = session_id
      AND (public.is_group_member(auth.uid(), ss.group_id) OR public.is_group_admin(auth.uid(), ss.group_id))
    ))
    -- Or group admins can update anyone's status
    OR EXISTS (
      SELECT 1 FROM public.study_sessions ss
      WHERE ss.id = session_id
      AND public.is_group_admin(auth.uid(), ss.group_id)
    )
  );

-- Secure KU purchase function (SECURITY DEFINER runs with elevated privileges)
-- This moves the logic from the frontend to the backend to prevent balance manipulation
CREATE OR REPLACE FUNCTION public.purchase_library_slot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  -- Get current balance
  SELECT balance INTO v_balance
  FROM public.ku_wallets
  WHERE user_id = auth.uid();

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF v_balance < 5 THEN
    RAISE EXCEPTION 'Insufficient Knowledge Units';
  END IF;

  -- Update wallet: deduct 5 KU and add 1 slot
  UPDATE public.ku_wallets
  SET balance = balance - 5,
      library_slots = library_slots + 1,
      updated_at = now()
  WHERE user_id = auth.uid();

  -- Log transaction securely
  INSERT INTO public.ku_transactions (user_id, amount, type, description)
  VALUES (auth.uid(), -5, 'library_slot', 'Purchased 1 library slot');
END;
$$;
