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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find users who haven't logged in for 2 days
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const { data: inactiveUsers, error: fetchError } = await supabase
      .from('user_settings')
      .select('user_id, preferred_name, last_studied_topic, fcm_token')
      .lt('updated_at', twoDaysAgo.toISOString())
      .not('fcm_token', 'is', null);

    if (fetchError) throw fetchError;

    const notifications = inactiveUsers.map(user => {
      const topic = user.last_studied_topic || "your courses";
      return {
        to: user.fcm_token,
        notification: {
          title: `Daily Mastery: ${user.preferred_name || 'Student'}`,
          body: `Forget the exams for a moment. Want to truly understand why ${topic} matters in real life? Ezra has a new analogy for you. 🧠`,
          click_action: "https://alphify.site/lecture"
        }
      };
    });

    // In a real scenario, we would loop and send to FCM API here
    console.log(`Prepared ${notifications.length} notifications`);

    return new Response(JSON.stringify({ success: true, count: notifications.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
