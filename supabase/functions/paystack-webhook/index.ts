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

    const units = checkout.units;
    const userId = checkout.user_id;
    const target = checkout.target;
    const groupId = checkout.group_id;

    // Credit wallet
    if (target === "personal") {
      const { data: wallet } = await serviceClient
        .from("ku_wallets").select("balance").eq("user_id", userId).maybeSingle();

      if (wallet) {
        await serviceClient.from("ku_wallets")
          .update({ balance: wallet.balance + units })
          .eq("user_id", userId);
      } else {
        await serviceClient.from("ku_wallets")
          .insert({ user_id: userId, balance: units + 3 });
      }
    } else {
      const { data: groupWallet } = await serviceClient
        .from("group_wallets").select("balance").eq("group_id", groupId).maybeSingle();

      if (groupWallet) {
        await serviceClient.from("group_wallets")
          .update({ balance: groupWallet.balance + units })
          .eq("group_id", groupId);
      } else {
        await serviceClient.from("group_wallets")
          .insert({ group_id: groupId, balance: units });
      }
    }

    const planLabel = checkout.package_type
      ? `ku_${checkout.package_type}_${target}`
      : `ku_custom_${units}_${target}`;

    // Log transaction
    await serviceClient.from("ku_transactions").insert({
      user_id: userId,
      group_id: target === "group" ? groupId : null,
      amount: units,
      type: "purchase",
      description: `Purchased ${units} KU for ${target} wallet (webhook)`,
    });

    // Record payment
    await serviceClient.from("payment_history").insert({
      user_id: userId,
      amount,
      currency: "NGN",
      paystack_reference: reference,
      plan: planLabel,
      status: "success",
    });

    // Update pending checkout status
    await serviceClient.from("pending_checkouts")
      .update({ status: "completed" })
      .eq("id", checkout.id);

    console.log(`Webhook: Credited ${units} KU to ${target} wallet for user ${userId}`);

    return new Response(JSON.stringify({ received: true, credited: true }), {
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
