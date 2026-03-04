import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleAuth } from "https://esm.sh/google-auth-library@9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get Google Access Token for FCM v1
    const serviceAccount = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "{}");
    const auth = new GoogleAuth({
        credentials: {
            client_email: serviceAccount.client_email,
            private_key: serviceAccount.private_key,
        },
        scopes: "https://www.googleapis.com/auth/firebase.messaging",
    });
    const accessToken = await auth.getAccessToken();

    // 2. Find students who haven't logged in for 2 days (48 hours)
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    const { data: inactiveUsers, error: fetchError } = await supabase
      .from('user_settings')
      .select('user_id, preferred_name, last_studied_topic, fcm_token')
      .lt('updated_at', fortyEightHoursAgo.toISOString())
      .not('fcm_token', 'is', null);

    if (fetchError) throw fetchError;

    // 3. Send notifications via FCM v1
    const projectId = serviceAccount.project_id;
    const sendResults = [];

    for (const user of inactiveUsers) {
      const topic = user.last_studied_topic || "your courses";
      const payload = {
        message: {
          token: user.fcm_token,
          notification: {
            title: `Daily Mastery: ${user.preferred_name || 'Student'} 🧠`,
            body: `Forget the exams for a moment. Want to truly understand why ${topic} matters in real life? Ezra has a new analogy for you.`
          },
          webpush: {
            fcm_options: {
              link: "https://alphify.site/lecture"
            }
          }
        }
      };

      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();
      sendResults.push({ userId: user.user_id, success: response.ok, result });
    }

    return new Response(JSON.stringify({
      success: true,
      count: inactiveUsers.length,
      details: sendResults
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
