
-- Create a robust function to handle KU purchases atomically
CREATE OR REPLACE FUNCTION public.handle_ku_purchase(
  _user_id UUID,
  _reference TEXT,
  _amount_kobo INTEGER,
  _units INTEGER,
  _bonus_ku INTEGER,
  _promo_code TEXT,
  _target TEXT,
  _group_id UUID,
  _package_type TEXT,
  _plan_label TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_units INTEGER;
  v_wallet_balance INTEGER;
  v_description TEXT;
  v_promo_data RECORD;
  v_commission_kobo INTEGER;
  v_commission_naira NUMERIC;
  v_existing_success BOOLEAN;
BEGIN
  v_total_units := _units + _bonus_ku;

  -- 1. Check for duplicate successful payment
  SELECT EXISTS (
    SELECT 1 FROM payment_history
    WHERE paystack_reference = _reference
    AND status = 'success'
  ) INTO v_existing_success;

  IF v_existing_success THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment already processed');
  END IF;

  -- 2. Credit Wallet
  IF _target = 'personal' THEN
    INSERT INTO ku_wallets (user_id, balance)
    VALUES (_user_id, v_total_units + 3) -- +3 for new wallet bonus
    ON CONFLICT (user_id) DO UPDATE
    SET balance = ku_wallets.balance + v_total_units,
        updated_at = now()
    RETURNING balance INTO v_wallet_balance;
  ELSIF _target = 'group' THEN
    IF _group_id IS NULL THEN
       RAISE EXCEPTION 'Group ID required for group purchase';
    END IF;
    INSERT INTO group_wallets (group_id, balance)
    VALUES (_group_id, v_total_units)
    ON CONFLICT (group_id) DO UPDATE
    SET balance = group_wallets.balance + v_total_units,
        updated_at = now()
    RETURNING balance INTO v_wallet_balance;
  ELSE
    RAISE EXCEPTION 'Invalid target: %', _target;
  END IF;

  -- 3. Log Transaction
  v_description := CASE
    WHEN _bonus_ku > 0 THEN 'Purchased ' || _units || ' KU + ' || _bonus_ku || ' bonus KU (promo: ' || COALESCE(_promo_code, 'none') || ') for ' || _target || ' wallet'
    ELSE 'Purchased ' || _units || ' KU for ' || _target || ' wallet'
  END;

  INSERT INTO ku_transactions (user_id, group_id, amount, type, description)
  VALUES (_user_id, CASE WHEN _target = 'group' THEN _group_id ELSE NULL END, v_total_units, 'purchase', v_description);

  -- 4. Record Payment History
  INSERT INTO payment_history (user_id, amount, currency, paystack_reference, plan, status)
  VALUES (_user_id, _amount_kobo, 'NGN', _reference, _plan_label, 'success');

  -- 5. Update Pending Checkout
  UPDATE pending_checkouts
  SET status = 'completed', updated_at = now()
  WHERE reference = _reference;

  -- 6. Process Promo Commission (if applicable)
  IF _promo_code IS NOT NULL AND _promo_code != '' THEN
    SELECT * INTO v_promo_data FROM promo_codes WHERE code ILIKE _promo_code AND is_active = true LIMIT 1;

    IF FOUND THEN
      v_commission_kobo := ROUND(_amount_kobo * COALESCE(v_promo_data.commission_rate, 0.10));
      v_commission_naira := v_commission_kobo / 100.0;

      INSERT INTO promo_code_usage (promo_code_id, user_id, payment_reference, purchase_amount_kobo, commission_amount_kobo)
      VALUES (v_promo_data.id, _user_id, _reference, _amount_kobo, v_commission_kobo);

      UPDATE promo_codes
      SET total_uses = COALESCE(total_uses, 0) + 1,
          total_commission_naira = COALESCE(total_commission_naira, 0) + v_commission_naira,
          updated_at = now()
      WHERE id = v_promo_data.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_wallet_balance,
    'total_units', v_total_units
  );
END;
$$;
