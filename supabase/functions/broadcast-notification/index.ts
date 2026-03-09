import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify this is called with service role key (admin only)
    const authHeader = req.headers.get("Authorization");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!authHeader || !authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) {
      return new Response(JSON.stringify({ error: "Unauthorized. Service role key required." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, body, link } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "title and body are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all users with FCM tokens
    const { data: users, error: fetchError } = await supabase
      .from("user_settings")
      .select("user_id, fcm_token")
      .not("fcm_token", "is", null);

    if (fetchError) throw fetchError;

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: "No users with FCM tokens found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            userId: user.user_id,
            title,
            body,
            data: {
              type: "broadcast",
              link: link || "https://alphify.site/dashboard",
            },
          }),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: users.length,
      sent: successCount,
      failed: failCount,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
