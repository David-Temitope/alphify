import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JWT } from "https://esm.sh/google-auth-library@9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, body, data } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "title and body are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all users with FCM tokens
    const { data: users, error: fetchError } = await supabase
      .from("user_settings")
      .select("user_id, fcm_token")
      .not("fcm_token", "is", null)
      .neq("fcm_token", "");

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, message: "No users with FCM tokens" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Firebase Auth
    const FIREBASE_SERVICE_ACCOUNT = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!);
    const client = new JWT({
      email: FIREBASE_SERVICE_ACCOUNT.client_email,
      key: FIREBASE_SERVICE_ACCOUNT.private_key,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const tokenRes = await client.authorize();
    const accessToken = tokenRes.access_token;

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${FIREBASE_SERVICE_ACCOUNT.project_id}/messages:send`;

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Send to all users in batches of 10
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (user) => {
          const res = await fetch(fcmUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              message: {
                token: user.fcm_token,
                notification: { title, body },
                data: { type: "broadcast", ...(data || {}) },
                webpush: {
                  fcm_options: {
                    link: data?.link || "https://alphify.site/dashboard",
                  },
                },
              },
            }),
          });

          if (!res.ok) {
            const err = await res.text();
            throw new Error(`User ${user.user_id}: ${err}`);
          }
          return res.json();
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") sent++;
        else {
          failed++;
          errors.push(r.reason?.message || "Unknown error");
        }
      }
    }

    return new Response(
      JSON.stringify({ sent, failed, total: users.length, errors: errors.slice(0, 5) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
