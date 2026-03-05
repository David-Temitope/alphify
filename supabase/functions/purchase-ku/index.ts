import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reference, packageType, target: reqTarget, groupId, customUnits, fromPending, promoCode } = await req.json();

    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let units: number;
    let expectedAmount: number;
    let target: string;
    let groupIdResolved: string | null = null;
    let packageTypeResolved: string | null = null;
    let promoCodeResolved: string | null = promoCode || null;

    if (fromPending) {
      const { data: checkout } = await serviceClient
        .from("pending_checkouts")
        .select("*")
        .eq("reference", reference)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!checkout) {
        return new Response(JSON.stringify({ error: "No pending checkout found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (target === "group" && !groupIdResolved) {
      return new Response(JSON.stringify({ error: "Group ID required for group purchase" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check duplicate SUCCESSFUL payment
    const { data: existingSuccess } = await serviceClient
      .from("payment_history")
      .select("id")
      .eq("paystack_reference", reference)
      .eq("status", "success")
      .maybeSingle();

    if (existingSuccess) {
      return new Response(JSON.stringify({ error: "Payment already processed and units credited" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

      if (attempt < 2 && (paystackData?.data?.status === "pending" || paystackData?.data?.status === "ongoing")) {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }

      await serviceClient.from("payment_history").insert({
        user_id: user.id, amount: paystackData?.data?.amount || 0,
        currency: "NGN", paystack_reference: reference,
        plan: `ku_${packageTypeResolved || 'custom_' + units}`, status: "failed",
      });

      return new Response(JSON.stringify({ error: "Payment verification failed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!paystackData?.data || paystackData.data.status !== "success") {
      return new Response(JSON.stringify({ error: "Payment not successful" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (paystackData.data.amount !== expectedAmount) {
      return new Response(JSON.stringify({ error: "Amount mismatch" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate metadata
    const metadata = paystackData.data.metadata ?? {};
    const customFields = Array.isArray(metadata.custom_fields) ? metadata.custom_fields : [];
    const metadataUserId = customFields.find((f: any) => f.variable_name === "user_id")?.value;
    if (metadataUserId && metadataUserId !== user.id) {
      return new Response(JSON.stringify({ error: "User mismatch" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let metadataPromoCode = customFields.find((f: any) => f.variable_name === "promo_code")?.value;

    if (!metadataPromoCode && typeof metadata === "string") {
      try {
        const parsedMetadata = JSON.parse(metadata);
        const parsedFields = Array.isArray(parsedMetadata.custom_fields) ? parsedMetadata.custom_fields : [];
        metadataPromoCode = parsedFields.find((f: any) => f.variable_name === "promo_code")?.value;
      } catch (e) { /* ignore */ }
    }

    console.log(`Resolving promo code for ref ${reference}. Request: ${promoCode}, Pending: ${checkout?.promo_code}, Metadata: ${metadataPromoCode}`);

    // Prioritize pending checkout stored code, then request, then metadata
    promoCodeResolved = (checkout?.promo_code) || promoCode || metadataPromoCode || null;

    // === RESOLVE PROMO BONUS KU ===
    let bonusKu = 0;
    let promoData: any = null;

    if (promoCodeResolved && promoCodeResolved.trim() !== "") {
      try {
        console.log(`Looking up promo code: "${promoCodeResolved}"`);
        const { data: promo, error: promoError } = await serviceClient
          .from("promo_codes")
          .select("*")
          .ilike("code", promoCodeResolved.trim())
          .eq("is_active", true)
          .maybeSingle();

        if (promoError) console.error("Database error looking up promo:", promoError);

        if (promo) {
          // Check expiry
          const expiresAt = (promo as any).expires_at;
          if (!expiresAt || new Date(expiresAt) > new Date()) {
            bonusKu = (promo as any).bonus_ku ?? 5;
            promoData = promo;
            // Update the resolved code with the canonical one from DB
            promoCodeResolved = promo.code;
            console.log(`Promo validated: ${promoCodeResolved}. Bonus KU: ${bonusKu}`);
          } else {
            console.log(`Promo ${promoCodeResolved} expired at ${expiresAt}`);
          }
        } else {
          console.log(`No active promo found for code: ${promoCodeResolved}`);
        }
      } catch (e) {
        console.error("Promo bonus lookup error:", e);
      }
    }

    const totalUnits = units + bonusKu;

    // Credit wallet
    if (target === "personal") {
      const { data: wallet } = await serviceClient
        .from("ku_wallets").select("balance").eq("user_id", user.id).maybeSingle();

      if (wallet) {
        await serviceClient.from("ku_wallets")
          .update({ balance: wallet.balance + totalUnits })
          .eq("user_id", user.id);
      } else {
        await serviceClient.from("ku_wallets")
          .insert({ user_id: user.id, balance: totalUnits + 3 });
      }
    } else {
      const { data: groupWallet } = await serviceClient
        .from("group_wallets").select("balance").eq("group_id", groupIdResolved).maybeSingle();

      if (groupWallet) {
        await serviceClient.from("group_wallets")
          .update({ balance: groupWallet.balance + totalUnits })
          .eq("group_id", groupIdResolved);
      } else {
        await serviceClient.from("group_wallets")
          .insert({ group_id: groupIdResolved, balance: totalUnits });
      }
    }

    const planLabel = packageTypeResolved ? `ku_${packageTypeResolved}_${target}` : `ku_custom_${units}_${target}`;

    // Log transaction
    const description = bonusKu > 0
      ? `Purchased ${units} KU + ${bonusKu} bonus KU (promo: ${promoCodeResolved}) for ${target} wallet`
      : `Purchased ${units} KU for ${target} wallet`;

    await serviceClient.from("ku_transactions").insert({
      user_id: user.id,
      group_id: target === "group" ? groupIdResolved : null,
      amount: totalUnits,
      type: "purchase",
      description,
    });

    // Record payment
    await serviceClient.from("payment_history").insert({
      user_id: user.id, amount: paystackData.data.amount,
      currency: "NGN", paystack_reference: reference,
      plan: planLabel, status: "success",
    });

    // Mark pending checkout as completed
    await serviceClient.from("pending_checkouts")
      .update({ status: "completed" })
      .eq("reference", reference);

    // === PROMO CODE COMMISSION ===
    if (promoData) {
      try {
        const amountKobo = paystackData?.data?.amount || expectedAmount;
        const commissionKobo = Math.round(amountKobo * (promoData.commission_rate || 0.10));
        const commissionNaira = commissionKobo / 100;

        console.log(`Recording promo usage: code=${promoCodeResolved}, user=${user.id}, amount=${amountKobo}, commission=${commissionKobo}`);

        // Record usage
        const { error: usageError } = await serviceClient.from("promo_code_usage").insert({
          promo_code_id: promoData.id,
          user_id: user.id,
          payment_reference: reference,
          purchase_amount_kobo: amountKobo,
          commission_amount_kobo: commissionKobo,
        });

        if (usageError) {
          console.error(`Error recording promo usage for ${promoCodeResolved}:`, usageError);
        } else {
          // Update promo code stats
          const { error: statsError } = await serviceClient.from("promo_codes").update({
            total_uses: (promoData.total_uses || 0) + 1,
            total_commission_naira: Number(promoData.total_commission_naira || 0) + commissionNaira,
            updated_at: new Date().toISOString(),
          }).eq("id", promoData.id);

          if (statsError) {
            console.error(`Error updating promo stats for ${promoCodeResolved}:`, statsError);
          } else {
            console.log(`Promo ${promoCodeResolved}: commission ₦${commissionNaira} successfully recorded`);
          }
        }
      } catch (e) {
        console.error("Promo code processing error:", e);
      }
    }

    // Send Real-time Firebase Notification
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          userId: user.id,
          title: "Wallet Topped Up! 🧠",
          body: bonusKu > 0
            ? `Added ${units} + ${bonusKu} bonus KU (total ${totalUnits}) to your ${target} wallet!`
            : `Successfully added ${totalUnits} KU to your ${target} wallet.`,
          data: { link: "https://alphify.site/settings?tab=wallet" }
        }),
      });
    } catch (e) {
      console.error("Firebase notification failed:", e);
    }

    // Expire stale pending checkouts
    try { await serviceClient.rpc("expire_stale_checkouts"); } catch { /* ignore */ }

    // Reward referrer if this is the referred user's first purchase
    if (target === "personal") {
      try { await serviceClient.rpc("reward_referral_on_purchase", { _referred_user_id: user.id }); } catch { /* ignore */ }
    }

    // Send Slack notification (fire-and-forget)
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/slack-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          event: "payment_success",
          data: {
            email: user.email,
            amount: paystackData.data.amount,
            units,
            target,
            promoCode: promoCodeResolved || undefined,
          },
        }),
      });
    } catch (e) {
      console.error("Slack notify failed:", e);
    }

    // Get updated balance
    let newBalance = 0;
    if (target === "personal") {
      const { data } = await serviceClient.from("ku_wallets").select("balance").eq("user_id", user.id).single();
      newBalance = data?.balance || 0;
    } else {
      const { data } = await serviceClient.from("group_wallets").select("balance").eq("group_id", groupIdResolved).single();
      newBalance = data?.balance || 0;
    }

    return new Response(JSON.stringify({ success: true, balance: newBalance, units: totalUnits }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Purchase KU error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
