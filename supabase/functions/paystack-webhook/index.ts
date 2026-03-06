import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

type PaystackCustomField = { variable_name?: string; value?: string };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

const KU_PACKAGES: Record<string, { units: number; amount: number }> = {
  starter: { units: 25, amount: 87500 },
  standard: { units: 50, amount: 175000 },
  bulk: { units: 100, amount: 350000 },
  mega: { units: 150, amount: 525000 },
};

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

const resolveUnitsFromPackage = (packageValue: string | null, amount: number): number | null => {
  if (!packageValue) return null;

  const normalized = packageValue.trim().toLowerCase();
  if (KU_PACKAGES[normalized]) return KU_PACKAGES[normalized].units;

  if (normalized.startsWith("custom_")) {
    const parsed = Number.parseInt(normalized.replace("custom_", ""), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  // Last fallback: infer from amount using 35 NGN/KU
  if (amount > 0 && amount % 3500 === 0) {
    return Math.floor(amount / 3500);
  }

  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.text();

    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      console.error("Missing Paystack signature");
      return new Response("Unauthorized", { status: 401 });
    }

    const hash = createHmac("sha512", PAYSTACK_SECRET_KEY).update(body).digest("hex");
    if (hash !== signature) {
      console.error("Invalid Paystack signature");
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = JSON.parse(body);
    if (payload.event !== "charge.success") {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const txData = payload.data;
    const reference = txData?.reference;
    const amount = txData?.amount;
    const metadata = txData?.metadata ?? {};

    if (!reference || !Number.isFinite(amount)) {
      console.error("Invalid webhook payload", { reference, amount });
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // First attempt: use pending checkout (primary source)
    const { data: checkout } = await serviceClient
      .from("pending_checkouts")
      .select("user_id, units, expected_amount, target, group_id, package_type, promo_code")
      .eq("reference", reference)
      .eq("status", "pending")
      .maybeSingle();

    let userId: string | null = checkout?.user_id ?? null;
    let units: number | null = checkout?.units ?? null;
    let expectedAmount: number | null = checkout?.expected_amount ?? null;
    let target: "personal" | "group" = (checkout?.target as "personal" | "group") || "personal";
    let groupId: string | null = checkout?.group_id ?? null;
    let packageType = checkout?.package_type ?? null;
    let promoCodeResolved = checkout?.promo_code ?? null;

    // Fallback: reconstruct from metadata if pending checkout is missing
    if (!checkout) {
      userId = getCustomFieldValue(metadata, "user_id");
      target = (getCustomFieldValue(metadata, "target") as "personal" | "group") || "personal";
      groupId = getCustomFieldValue(metadata, "group_id");
      packageType = getCustomFieldValue(metadata, "package");
      promoCodeResolved = getCustomFieldValue(metadata, "promo_code");

      const inferredUnits = resolveUnitsFromPackage(packageType, amount);
      if (!userId || !inferredUnits) {
        console.warn("No pending checkout and metadata fallback is incomplete", { reference, userId, packageType });
        return new Response(JSON.stringify({ received: true, no_checkout: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      units = inferredUnits;
      expectedAmount = amount;
    }

    if (!userId || !units || !expectedAmount) {
      console.error("Unable to resolve checkout details", { reference, userId, units, expectedAmount });
      return new Response(JSON.stringify({ error: "Unable to resolve checkout" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (amount !== expectedAmount) {
      console.error("Amount mismatch", { reference, webhook: amount, expected: expectedAmount });
      if (checkout) {
        await serviceClient.from("pending_checkouts").update({ status: "amount_mismatch" }).eq("reference", reference);
      }
      return new Response(JSON.stringify({ error: "Amount mismatch" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve promo bonus from canonical promo table
    let bonusKu = 0;
    if (promoCodeResolved && promoCodeResolved.trim()) {
      const { data: promo } = await serviceClient
        .from("promo_codes")
        .select("code, bonus_ku, expires_at")
        .ilike("code", promoCodeResolved.trim())
        .eq("is_active", true)
        .maybeSingle();

      if (promo && (!promo.expires_at || new Date(promo.expires_at) > new Date())) {
        bonusKu = promo.bonus_ku ?? 5;
        promoCodeResolved = promo.code;
      } else {
        promoCodeResolved = null;
      }
    }

    const planLabel = packageType ? `ku_${packageType}_${target}` : `ku_custom_${units}_${target}`;

    const { data: resultData, error: purchaseError } = await serviceClient.rpc("handle_ku_purchase", {
      _user_id: userId,
      _reference: reference,
      _amount_kobo: amount,
      _units: units,
      _bonus_ku: bonusKu,
      _promo_code: promoCodeResolved,
      _target: target,
      _group_id: groupId,
      _package_type: packageType,
      _plan_label: planLabel,
    });

    if (purchaseError || !resultData?.success) {
      console.error("Webhook purchase processing failed", {
        reference,
        error: purchaseError?.message || resultData?.error,
      });
      return new Response(JSON.stringify({ error: "Failed to credit wallet" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ received: true, credited: true, units: resultData.total_units, already_processed: resultData.already_processed }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
