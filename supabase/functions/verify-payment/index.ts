import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error("PAYSTACK_SECRET_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration is missing");
    }

    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const anonClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY") || ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reference, plan } = await req.json();

    if (!reference || !plan) {
      return new Response(
        JSON.stringify({ error: "Missing reference or plan" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify payment with Paystack
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const paystackData = await paystackResponse.json();

    if (!paystackData.status || paystackData.data.status !== "success") {
      // Record failed payment
      await supabaseClient.from("payment_history").insert({
        user_id: user.id,
        amount: paystackData.data?.amount || 0,
        currency: "NGN",
        paystack_reference: reference,
        plan,
        status: "failed",
      });

      return new Response(
        JSON.stringify({ error: "Payment verification failed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: existingPayment, error: existingPaymentError } =
      await supabaseClient
        .from("payment_history")
        .select("id, status")
        .eq("paystack_reference", reference)
        .maybeSingle();

    if (existingPaymentError) {
      throw existingPaymentError;
    }

    if (existingPayment) {
      return new Response(
        JSON.stringify({ error: "Payment already processed" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const metadata = paystackData.data.metadata ?? {};
    const customFields = Array.isArray(metadata.custom_fields)
      ? metadata.custom_fields
      : [];
    const metadataUserId = customFields.find(
      (field: { variable_name?: string }) => field.variable_name === "user_id"
    )?.value;
    const metadataPlan = customFields.find(
      (field: { variable_name?: string }) => field.variable_name === "plan"
    )?.value;

    if (metadataUserId && metadataUserId !== user.id) {
      return new Response(
        JSON.stringify({ error: "Payment metadata mismatch" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (metadataPlan && metadataPlan !== plan) {
      return new Response(
        JSON.stringify({ error: "Plan mismatch" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (user.email && paystackData.data.customer?.email) {
      if (paystackData.data.customer.email !== user.email) {
        return new Response(
          JSON.stringify({ error: "Customer mismatch" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Verify amount matches plan
    const expectedAmounts: Record<string, number> = {
      basic: 300000,
      pro: 500000,
      premium: 1000000,
    };

    if (paystackData.data.amount !== expectedAmounts[plan]) {
      return new Response(
        JSON.stringify({ error: "Amount mismatch" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Calculate subscription period (30 days)
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Upsert subscription
    const { error: subError } = await supabaseClient
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan,
          status: "active",
          paystack_customer_code: paystackData.data.customer?.customer_code || null,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (subError) {
      console.error("Subscription update error:", subError);
      throw new Error("Failed to update subscription");
    }

    // Record successful payment
    await supabaseClient.from("payment_history").insert({
      user_id: user.id,
      amount: paystackData.data.amount,
      currency: "NGN",
      paystack_reference: reference,
      plan,
      status: "success",
    });

    return new Response(
      JSON.stringify({ success: true, plan, expiresAt: periodEnd.toISOString() }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error verifying payment:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
