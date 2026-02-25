import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KU_PACKAGES: Record<string, { units: number; amount: number }> = {
  starter: { units: 10, amount: 50000 },
  standard: { units: 25, amount: 125000 },
  bulk: { units: 50, amount: 250000 },
  mega: { units: 100, amount: 500000 },
};

const PRICE_PER_UNIT = 5000; // ₦50 in kobo

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY not configured");

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

    const { reference, packageType, target: reqTarget, groupId, customUnits, fromPending } = await req.json();

    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // If fromPending, look up checkout details from pending_checkouts table
    let units: number;
    let expectedAmount: number;
    let target: string;
    let groupIdResolved: string | null = null;
    let packageTypeResolved: string | null = null;

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
    } else {
      target = reqTarget;
      groupIdResolved = groupId || null;
      packageTypeResolved = packageType || null;

      if (!target) {
        return new Response(JSON.stringify({ error: "Missing target" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Support both preset packages and custom amounts
      if (customUnits && typeof customUnits === "number" && customUnits >= 1) {
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

    // serviceClient already created above

    // Check duplicate
    const { data: existingPayment } = await serviceClient
      .from("payment_history")
      .select("id")
      .eq("paystack_reference", reference)
      .maybeSingle();

    if (existingPayment) {
      return new Response(JSON.stringify({ error: "Payment already processed" }), {
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

    // Credit wallet
    if (target === "personal") {
      const { data: wallet } = await serviceClient
        .from("ku_wallets").select("balance").eq("user_id", user.id).maybeSingle();

      if (wallet) {
        await serviceClient.from("ku_wallets")
          .update({ balance: wallet.balance + units })
          .eq("user_id", user.id);
      } else {
        await serviceClient.from("ku_wallets")
          .insert({ user_id: user.id, balance: units + 3 });
      }
    } else {
      const { data: groupWallet } = await serviceClient
        .from("group_wallets").select("balance").eq("group_id", groupIdResolved).maybeSingle();

      if (groupWallet) {
        await serviceClient.from("group_wallets")
          .update({ balance: groupWallet.balance + units })
          .eq("group_id", groupIdResolved);
      } else {
        await serviceClient.from("group_wallets")
          .insert({ group_id: groupIdResolved, balance: units });
      }
    }

    const planLabel = packageTypeResolved ? `ku_${packageTypeResolved}_${target}` : `ku_custom_${units}_${target}`;

    // Log transaction
    await serviceClient.from("ku_transactions").insert({
      user_id: user.id,
      group_id: target === "group" ? groupIdResolved : null,
      amount: units,
      type: "purchase",
      description: `Purchased ${units} KU for ${target} wallet`,
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

    // Expire stale pending checkouts
    try { await serviceClient.rpc("expire_stale_checkouts"); } catch { /* ignore */ }

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

    return new Response(JSON.stringify({ success: true, balance: newBalance, units }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Purchase KU error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
