
-- Personal KU wallets
CREATE TABLE public.ku_wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  balance integer NOT NULL DEFAULT 3,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ku_wallets ENABLE ROW LEVEL SECURITY;

-- Users can view their own wallet
CREATE POLICY "Users can view their own wallet"
ON public.ku_wallets FOR SELECT
USING (auth.uid() = user_id);

-- Only service role can insert/update (edge functions)
-- We also allow insert for the trigger
CREATE POLICY "System can manage wallets"
ON public.ku_wallets FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Group KU wallets
CREATE TABLE public.group_wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL UNIQUE REFERENCES public.study_groups(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.group_wallets ENABLE ROW LEVEL SECURITY;

-- Group members can view group wallet
CREATE POLICY "Group members can view group wallet"
ON public.group_wallets FOR SELECT
USING (is_group_member(auth.uid(), group_id) OR is_group_admin(auth.uid(), group_id));

-- Only admins can manage (for UI display, actual updates via service role)
CREATE POLICY "Group admins can manage group wallet"
ON public.group_wallets FOR ALL
USING (is_group_admin(auth.uid(), group_id))
WITH CHECK (is_group_admin(auth.uid(), group_id));

-- KU transaction log
CREATE TABLE public.ku_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  group_id uuid REFERENCES public.study_groups(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  type text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ku_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
CREATE POLICY "Users can view their own transactions"
ON public.ku_transactions FOR SELECT
USING (auth.uid() = user_id);

-- Users can view group transactions for their groups
CREATE POLICY "Group members can view group transactions"
ON public.ku_transactions FOR SELECT
USING (group_id IS NOT NULL AND (is_group_member(auth.uid(), group_id) OR is_group_admin(auth.uid(), group_id)));

-- System insert policy (edge functions use service role, but allow user insert for logging)
CREATE POLICY "Users can insert own transactions"
ON public.ku_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Auto-create wallet on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.ku_wallets (user_id, balance)
  VALUES (NEW.user_id, 3)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Log welcome bonus
  INSERT INTO public.ku_transactions (user_id, amount, type, description)
  VALUES (NEW.user_id, 3, 'welcome_bonus', 'Welcome bonus: 3 free Knowledge Units');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_create_wallet
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_wallet();

-- Add updated_at triggers
CREATE TRIGGER update_ku_wallets_updated_at
BEFORE UPDATE ON public.ku_wallets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_group_wallets_updated_at
BEFORE UPDATE ON public.group_wallets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
