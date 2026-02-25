
-- Update process_referral to NOT give 5KU immediately, just record the referral as unrewarded
CREATE OR REPLACE FUNCTION public.process_referral(_referral_code text, _referred_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _referrer_user_id uuid;
BEGIN
  SELECT user_id INTO _referrer_user_id FROM referral_codes WHERE code = UPPER(_referral_code);
  IF _referrer_user_id IS NULL THEN RETURN false; END IF;
  IF _referrer_user_id = _referred_user_id THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM referrals WHERE referred_user_id = _referred_user_id) THEN RETURN false; END IF;
  -- Record referral but do NOT reward yet (rewarded=false)
  INSERT INTO referrals (referrer_user_id, referred_user_id, rewarded) VALUES (_referrer_user_id, _referred_user_id, false);
  RETURN true;
END;
$function$;

-- New function: reward referrer when referred user makes first purchase
CREATE OR REPLACE FUNCTION public.reward_referral_on_purchase(_referred_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _referrer_user_id uuid;
BEGIN
  -- Find unrewarded referral for this user
  SELECT referrer_user_id INTO _referrer_user_id
  FROM referrals
  WHERE referred_user_id = _referred_user_id AND rewarded = false
  LIMIT 1;

  IF _referrer_user_id IS NULL THEN RETURN; END IF;

  -- Mark as rewarded
  UPDATE referrals SET rewarded = true WHERE referred_user_id = _referred_user_id AND referrer_user_id = _referrer_user_id;

  -- Credit 5 KU to referrer
  UPDATE ku_wallets SET balance = balance + 5, updated_at = now() WHERE user_id = _referrer_user_id;

  -- Log transaction
  INSERT INTO ku_transactions (user_id, amount, type, description)
  VALUES (_referrer_user_id, 5, 'referral_bonus', 'Referral bonus: your referred friend made their first purchase!');
END;
$function$;
