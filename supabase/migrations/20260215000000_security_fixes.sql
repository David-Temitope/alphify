
-- Drop insecure policies
DROP POLICY IF EXISTS "System can manage wallets" ON public.ku_wallets;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.ku_transactions;

-- Fix session_participants RLS
DROP POLICY IF EXISTS "Users can join sessions" ON public.session_participants;
CREATE POLICY "Users can join sessions" ON public.session_participants
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.study_sessions ss WHERE ss.id = session_id AND (
      (auth.uid() = user_id AND (public.is_group_member(auth.uid(), ss.group_id) OR public.is_group_admin(auth.uid(), ss.group_id)))
      OR public.is_group_admin(auth.uid(), ss.group_id)
    ))
  );

DROP POLICY IF EXISTS "Users can update their participation" ON public.session_participants;
CREATE POLICY "Users can update their participation" ON public.session_participants
  FOR UPDATE USING (
    (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.study_sessions ss WHERE ss.id = session_id AND (public.is_group_member(auth.uid(), ss.group_id) OR public.is_group_admin(auth.uid(), ss.group_id))))
    OR EXISTS (SELECT 1 FROM public.study_sessions ss WHERE ss.id = session_id AND public.is_group_admin(auth.uid(), ss.group_id))
  );

-- Secure KU purchase function
CREATE OR REPLACE FUNCTION public.purchase_library_slot()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_balance integer;
BEGIN
  SELECT balance INTO v_balance FROM public.ku_wallets WHERE user_id = auth.uid();
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF v_balance < 5 THEN RAISE EXCEPTION 'Insufficient Knowledge Units'; END IF;

  UPDATE public.ku_wallets SET balance = balance - 5, library_slots = library_slots + 1, updated_at = now() WHERE user_id = auth.uid();
  INSERT INTO public.ku_transactions (user_id, amount, type, description) VALUES (auth.uid(), -5, 'library_slot', 'Purchased 1 library slot');
END; $$;
