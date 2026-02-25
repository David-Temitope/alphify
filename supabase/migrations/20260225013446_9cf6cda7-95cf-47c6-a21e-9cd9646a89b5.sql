
-- Referral codes table
CREATE TABLE public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own referral code"
  ON public.referral_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Referral tracking table
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL,
  referred_user_id UUID NOT NULL UNIQUE,
  rewarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_user_id);

CREATE POLICY "System can insert referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referred_user_id);

-- Function to generate referral code from name
CREATE OR REPLACE FUNCTION public.generate_referral_code(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _name text;
  _prefix text;
  _code text;
  _counter int := 1;
BEGIN
  SELECT COALESCE(full_name, 'USER') INTO _name FROM profiles WHERE user_id = _user_id;
  _prefix := UPPER(LEFT(REGEXP_REPLACE(_name, '[^a-zA-Z]', '', 'g'), 3));
  IF LENGTH(_prefix) < 3 THEN
    _prefix := _prefix || REPEAT('X', 3 - LENGTH(_prefix));
  END IF;
  LOOP
    _code := _prefix || LPAD(_counter::text, 3, '0');
    IF NOT EXISTS (SELECT 1 FROM referral_codes WHERE code = _code) THEN
      RETURN _code;
    END IF;
    _counter := _counter + 1;
    EXIT WHEN _counter > 999;
  END LOOP;
  RETURN _prefix || LPAD(FLOOR(RANDOM() * 999 + 1)::text, 3, '0');
END;
$$;

-- Function to process referral (give 5 KU to referrer)
CREATE OR REPLACE FUNCTION public.process_referral(_referral_code text, _referred_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _referrer_user_id uuid;
BEGIN
  SELECT user_id INTO _referrer_user_id FROM referral_codes WHERE code = UPPER(_referral_code);
  IF _referrer_user_id IS NULL THEN RETURN false; END IF;
  IF _referrer_user_id = _referred_user_id THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM referrals WHERE referred_user_id = _referred_user_id) THEN RETURN false; END IF;
  INSERT INTO referrals (referrer_user_id, referred_user_id, rewarded) VALUES (_referrer_user_id, _referred_user_id, true);
  UPDATE ku_wallets SET balance = balance + 5, updated_at = now() WHERE user_id = _referrer_user_id;
  INSERT INTO ku_transactions (user_id, amount, type, description)
  VALUES (_referrer_user_id, 5, 'referral_bonus', 'Referral bonus: new user signed up with your code');
  RETURN true;
END;
$$;
