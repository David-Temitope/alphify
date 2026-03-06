import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PaystackCustomField = { variable_name?: string; value?: string };

type PendingCheckout = {
  units: number;
  expected_amount: number;
  target: "personal" | "group";
  group_id: string | null;
  package_type: string | null;
  promo_code: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KU_PACKAGES: Record<string, { units: number; amount: number }> = {
  starter: { units: 25, amount: 87500 },
  standard: { units: 50, amount: 175000 },
  bulk: { units: 100, amount: 350000 },
  mega: { units: 150, amount: 525000 },
};

const PRICE_PER_UNIT = 3500; // ₦35 in kobo

const getCustomFieldValue = (metadata: any, variableName: string): string | null => {
  if (!metadata) return null;

  const readFromFields = (fields: PaystackCustomField[]) =>
    fields.find((f) => f?.variable_name === variableName)?.value?.toString()?.trim() || null;

  const directFields = Array.isArray(metadata?.custom_fields) ? metadata.custom_fields : null;
  if (directFields) return readFromFields(directFields);

  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      const parsedFields = Array.isArray(parsed?.custom_fields) ? parsed.custom_fields : null;
      if (parsedFields) return readFromFields(parsedFields);
    } catch {
      return null;
    }
  }

  return null;
};

const resolvePromo = async (serviceClient: any, promoCode: string | null) => {
  if (!promoCode || !promoCode.trim()) {
    return { bonusKu: 0, promoCodeResolved: null as string | null };
  }

  const { data: promo, error } = await serviceClient
    .from("promo_codes")
    .select("code, bonus_ku, expires_at")
    .ilike("code", promoCode.trim())
    .eq("is_active", true)
    .maybeSingle();

  if (error || !promo) {
    if (error) console.error("Promo lookup error:", error);
    return { bonusKu: 0, promoCodeResolved: null as string | null };
  }

  if (promo.expires_at && new Date(promo.expires_at) <= new Date()) {
    return { bonusKu: 0, promoCodeResolved: null as string | null };
  }

  return {
    bonusKu: promo.bonus_ku ?? 5,
    promoCodeResolved: promo.code,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") || Deno.env.get("PAYSTACK_API_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("Paystack secret key not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reference, packageType, target: reqTarget, groupId, customUnits, fromPending, promoCode } = await req.json();

    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let units = 0;
    let expectedAmount = 0;
    let target: "personal" | "group" = "personal";
    let groupIdResolved: string | null = null;
    let packageTypeResolved: string | null = null;
    let promoCodeResolved: string | null = promoCode || null;
    let checkout: PendingCheckout | null = null;

    if (fromPending) {
      const { data: pendingCheckout } = await serviceClient
        .from("pending_checkouts")
        .select("units, expected_amount, target, group_id, package_type, promo_code")
        .eq("reference", reference)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();

      if (!pendingCheckout) {
        return new Response(JSON.stringify({ error: "No pending checkout found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      checkout = pendingCheckout as PendingCheckout;
      units = checkout.units;
      expectedAmount = checkout.expected_amount;
      target = checkout.target;
      groupIdResolved = checkout.group_id;
      packageTypeResolved = checkout.package_type;
      promoCodeResolved = checkout.promo_code || promoCodeResolved;
    } else {
      target = reqTarget;
      groupIdResolved = groupId || null;
      packageTypeResolved = packageType || null;

      if (!target) {
        return new Response(JSON.stringify({ error: "Missing target" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (customUnits && typeof customUnits === "number" && customUnits >= 25) {
        units = Math.floor(customUnits);
        expectedAmount = units * PRICE_PER_UNIT;
      } else if (packageType && KU_PACKAGES[packageType]) {
        const pkg = KU_PACKAGES[packageType];
        units = pkg.units;
        expectedAmount = pkg.amount;
      } else {
        return new Response(JSON.stringify({ error: "Invalid package or amount" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (target === "group" && !groupIdResolved) {
      return new Response(JSON.stringify({ error: "Group ID required for group purchase" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify with Paystack
    let paystackData: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });
      paystackData = await res.json().catch(() => null);

      if (paystackData?.data?.status === "success") break;

      if (
        attempt < 2 &&
        (paystackData?.data?.status === "pending" || paystackData?.data?.status === "ongoing")
      ) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        continue;
      }

      await serviceClient.from("payment_history").insert({
        user_id: user.id,
        amount: paystackData?.data?.amount || 0,
        currency: "NGN",
        paystack_reference: reference,
        plan: `ku_${packageTypeResolved || `custom_${units}`}`,
        status: "failed",
      });

      return new Response(JSON.stringify({ error: "Payment verification failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!paystackData?.data || paystackData.data.status !== "success") {
      return new Response(JSON.stringify({ error: "Payment not successful" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (paystackData.data.amount !== expectedAmount) {
      return new Response(JSON.stringify({ error: "Amount mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = paystackData.data.metadata ?? {};
    const metadataUserId = getCustomFieldValue(metadata, "user_id");
    const metadataPromoCode = getCustomFieldValue(metadata, "promo_code");

    if (metadataUserId && metadataUserId !== user.id) {
      return new Response(JSON.stringify({ error: "User mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    promoCodeResolved = checkout?.promo_code || promoCode || metadataPromoCode || null;
    const { bonusKu, promoCodeResolved: canonicalPromoCode } = await resolvePromo(serviceClient, promoCodeResolved);
    promoCodeResolved = canonicalPromoCode;

    const planLabel = packageTypeResolved
      ? `ku_${packageTypeResolved}_${target}`
      : `ku_custom_${units}_${target}`;

    const { data: resultData, error: purchaseError } = await serviceClient.rpc("handle_ku_purchase", {
      _user_id: user.id,
      _reference: reference,
      _amount_kobo: paystackData.data.amount,
      _units: units,
      _bonus_ku: bonusKu,
      _promo_code: promoCodeResolved,
      _target: target,
      _group_id: groupIdResolved,
      _package_type: packageTypeResolved,
      _plan_label: planLabel,
    });

    if (purchaseError) {
      console.error("Atomic purchase function error:", purchaseError);
      return new Response(JSON.stringify({ error: "Failed to credit wallet" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resultData?.success) {
      console.error("Atomic purchase function returned failure:", resultData?.error);
      return new Response(JSON.stringify({ error: resultData?.error || "Failed to credit wallet" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalUnits = resultData.total_units;

    // Expire stale pending checkouts (best effort)
    try {
      await serviceClient.rpc("expire_stale_checkouts");
    } catch {
      // ignore
    }

    if (target === "personal") {
      try {
        await serviceClient.rpc("reward_referral_on_purchase", { _referred_user_id: user.id });
      } catch {
        // ignore
      }
    }

    return new Response(JSON.stringify({ success: true, balance: resultData.new_balance, units: totalUnits }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Purchase KU error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
