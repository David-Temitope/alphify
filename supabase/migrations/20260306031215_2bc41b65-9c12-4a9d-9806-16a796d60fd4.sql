-- Ensure pending checkouts can persist promo codes and default verify window is 15 minutes
ALTER TABLE public.pending_checkouts
ADD COLUMN IF NOT EXISTS promo_code text;

ALTER TABLE public.pending_checkouts
ALTER COLUMN expires_at SET DEFAULT (now() + interval '15 minutes');

-- Idempotency guards
CREATE UNIQUE INDEX IF NOT EXISTS payment_history_success_reference_uniq
ON public.payment_history (paystack_reference)
WHERE status = 'success';

CREATE UNIQUE INDEX IF NOT EXISTS promo_code_usage_payment_reference_uniq
ON public.promo_code_usage (payment_reference);

-- Atomic KU purchase processor
CREATE OR REPLACE FUNCTION public.handle_ku_purchase(
  _user_id uuid,
  _reference text,
  _amount_kobo integer,
  _units integer,
  _bonus_ku integer,
  _promo_code text,
  _target text,
  _group_id uuid,
  _package_type text,
  _plan_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_units integer := GREATEST(COALESCE(_units, 0), 0) + GREATEST(COALESCE(_bonus_ku, 0), 0);
  v_new_balance integer := 0;
  v_commission_kobo integer := 0;
  v_inserted_count integer := 0;
  v_usage_inserted_count integer := 0;
  v_promo record;
BEGIN
  IF _reference IS NULL OR btrim(_reference) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_reference');
  END IF;

  IF _target NOT IN ('personal', 'group') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_target');
  END IF;

  IF v_total_units <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_units');
  END IF;

  -- Idempotency first: claim the reference before mutating balances
  INSERT INTO public.payment_history (user_id, amount, currency, paystack_reference, plan, status)
  VALUES (_user_id, _amount_kobo, 'NGN', _reference, COALESCE(_plan_label, 'ku_purchase'), 'success')
  ON CONFLICT (paystack_reference) WHERE status = 'success'
  DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  IF v_inserted_count = 0 THEN
    IF _target = 'group' THEN
      SELECT gw.balance INTO v_new_balance
      FROM public.group_wallets gw
      WHERE gw.group_id = _group_id
      LIMIT 1;
    ELSE
      SELECT kw.balance INTO v_new_balance
      FROM public.ku_wallets kw
      WHERE kw.user_id = _user_id
      ORDER BY kw.created_at DESC
      LIMIT 1;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'total_units', v_total_units,
      'new_balance', COALESCE(v_new_balance, 0)
    );
  END IF;

  -- Credit wallet
  IF _target = 'group' THEN
    IF _group_id IS NULL THEN
      RAISE EXCEPTION 'group_id_required';
    END IF;

    UPDATE public.group_wallets
    SET balance = balance + v_total_units,
        updated_at = now()
    WHERE group_id = _group_id
    RETURNING balance INTO v_new_balance;

    IF NOT FOUND THEN
      INSERT INTO public.group_wallets (group_id, balance)
      VALUES (_group_id, v_total_units)
      RETURNING balance INTO v_new_balance;
    END IF;
  ELSE
    UPDATE public.ku_wallets
    SET balance = balance + v_total_units,
        updated_at = now()
    WHERE user_id = _user_id
    RETURNING balance INTO v_new_balance;

    IF NOT FOUND THEN
      INSERT INTO public.ku_wallets (user_id, balance)
      VALUES (_user_id, 3 + v_total_units)
      RETURNING balance INTO v_new_balance;
    END IF;
  END IF;

  INSERT INTO public.ku_transactions (user_id, group_id, amount, type, description)
  VALUES (
    _user_id,
    CASE WHEN _target = 'group' THEN _group_id ELSE NULL END,
    v_total_units,
    'purchase',
    CASE
      WHEN _target = 'group' THEN format('Purchased %s KU for group wallet', v_total_units)
      ELSE format('Purchased %s KU for personal wallet', v_total_units)
    END
  );

  -- Promo usage + influencer counters
  IF _promo_code IS NOT NULL AND btrim(_promo_code) <> '' THEN
    SELECT p.*
    INTO v_promo
    FROM public.promo_codes p
    WHERE p.code ILIKE btrim(_promo_code)
      AND p.is_active = true
      AND (p.expires_at IS NULL OR p.expires_at > now())
    LIMIT 1;

    IF FOUND THEN
      v_commission_kobo := ROUND(_amount_kobo * COALESCE(v_promo.commission_rate, 0))::integer;

      INSERT INTO public.promo_code_usage (
        promo_code_id,
        user_id,
        purchase_amount_kobo,
        commission_amount_kobo,
        payment_reference
      )
      VALUES (
        v_promo.id,
        _user_id,
        _amount_kobo,
        v_commission_kobo,
        _reference
      )
      ON CONFLICT (payment_reference)
      DO NOTHING;

      GET DIAGNOSTICS v_usage_inserted_count = ROW_COUNT;

      IF v_usage_inserted_count > 0 THEN
        UPDATE public.promo_codes
        SET total_uses = COALESCE(total_uses, 0) + 1,
            total_commission_naira = COALESCE(total_commission_naira, 0) + (v_commission_kobo / 100.0),
            updated_at = now()
        WHERE id = v_promo.id;
      END IF;
    END IF;
  END IF;

  -- Mark pending checkout complete if present
  UPDATE public.pending_checkouts
  SET status = 'completed',
      promo_code = COALESCE(promo_code, NULLIF(btrim(_promo_code), '')),
      updated_at = now()
  WHERE reference = _reference
    AND user_id = _user_id
    AND status = 'pending';

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'total_units', v_total_units,
    'new_balance', v_new_balance
  );
END;
$$;