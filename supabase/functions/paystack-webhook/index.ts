import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
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

    // Verify Paystack signature
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      console.error("Missing Paystack signature");
      return new Response("Unauthorized", { status: 401 });
    }

    const hash = createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(body)
      .digest("hex");

    if (hash !== signature) {
      console.error("Invalid Paystack signature");
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = JSON.parse(body);
    const event = payload.event;

    console.log("Paystack webhook event:", event);

    if (event !== "charge.success") {
      // We only care about successful charges
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const txData = payload.data;
    const reference = txData.reference;
    const amount = txData.amount;

    if (!reference) {
      console.error("No reference in webhook payload");
      return new Response(JSON.stringify({ error: "No reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if already processed in payment_history
    const { data: existingPayment } = await serviceClient
      .from("payment_history")
      .select("id")
      .eq("paystack_reference", reference)
      .eq("status", "success")
      .maybeSingle();

    if (existingPayment) {
      console.log("Payment already processed:", reference);
      return new Response(JSON.stringify({ received: true, already_processed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the pending checkout
    const { data: checkout } = await serviceClient
      .from("pending_checkouts")
      .select("*")
      .eq("reference", reference)
      .eq("status", "pending")
      .maybeSingle();

    if (!checkout) {
      console.warn("No pending checkout found for reference:", reference);
      return new Response(JSON.stringify({ received: true, no_checkout: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify amount matches
    if (amount !== checkout.expected_amount) {
      console.error("Amount mismatch:", { webhook: amount, expected: checkout.expected_amount });
      await serviceClient.from("pending_checkouts")
        .update({ status: "amount_mismatch" })
        .eq("id", checkout.id);
      return new Response(JSON.stringify({ error: "Amount mismatch" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = payload.data.metadata ?? {};
    const customFields = Array.isArray(metadata.custom_fields) ? metadata.custom_fields : [];
    let metadataPromoCode = customFields.find((f: any) => f.variable_name === "promo_code")?.value;

    if (!metadataPromoCode && typeof metadata === "string") {
      try {
        const parsedMetadata = JSON.parse(metadata);
        const parsedFields = Array.isArray(parsedMetadata.custom_fields) ? parsedMetadata.custom_fields : [];
        metadataPromoCode = parsedFields.find((f: any) => f.variable_name === "promo_code")?.value;
      } catch (e) { /* ignore */ }
    }

    const units = checkout.units;
    const userId = checkout.user_id;
    const target = checkout.target;
    const groupId = checkout.group_id;
    let promoCodeResolved = checkout.promo_code || metadataPromoCode || null;

    // === RESOLVE PROMO BONUS KU ===
    let bonusKu = 0;
    let promoData: any = null;

    if (promoCodeResolved) {
      try {
        const { data: promo } = await serviceClient
          .from("promo_codes")
          .select("*")
          .ilike("code", promoCodeResolved.trim())
          .eq("is_active", true)
          .maybeSingle();

        if (promo) {
          // Check expiry
          const expiresAt = (promo as any).expires_at;
          if (!expiresAt || new Date(expiresAt) > new Date()) {
            bonusKu = (promo as any).bonus_ku ?? 5;
            promoData = promo;
            // Update the resolved code with the canonical one from DB
            promoCodeResolved = promo.code;
          }
        }
      } catch (e) {
        console.error("Promo bonus lookup error (webhook):", e);
      }
    }

    const planLabel = checkout.package_type
      ? `ku_${checkout.package_type}_${target}`
      : `ku_custom_${units}_${target}`;

    console.log(`Webhook: Executing atomic handle_ku_purchase for ref ${reference}. Units: ${units}, Bonus: ${bonusKu}, Promo: ${promoCodeResolved}`);

    const { data: resultData, error: purchaseError } = await serviceClient.rpc("handle_ku_purchase", {
      _user_id: userId,
      _reference: reference,
      _amount_kobo: amount,
      _units: units,
      _bonus_ku: bonusKu,
      _promo_code: promoCodeResolved || null,
      _target: target,
      _group_id: groupId,
      _package_type: checkout.package_type,
      _plan_label: planLabel
    });

    if (purchaseError) {
      console.error("Webhook: Atomic purchase function error:", purchaseError);
      return new Response(JSON.stringify({ error: "Failed to credit wallet" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resultData?.success) {
      console.error("Webhook: Atomic purchase function returned failure:", resultData?.error);
      return new Response(JSON.stringify({ error: resultData?.error || "Failed to credit wallet" }), {
        status: 200, // Still 200 because Paystack should stop retrying if we have a business logic failure we handled
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalUnits = resultData.total_units;

    // Send Real-time Firebase Notification
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          userId: userId,
          title: "Wallet Topped Up! 🧠",
          body: bonusKu > 0
            ? `Added ${units} + ${bonusKu} bonus KU (total ${totalUnits}) to your ${target} wallet!`
            : `Successfully added ${totalUnits} KU to your ${target} wallet.`,
          data: { link: "https://alphify.site/settings?tab=wallet" }
        }),
      });
    } catch (e) {
      console.error("Firebase notification failed (webhook):", e);
    }

    console.log(`Webhook: Credited ${totalUnits} KU to ${target} wallet for user ${userId}`);

    return new Response(JSON.stringify({ received: true, credited: true, units: totalUnits }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
