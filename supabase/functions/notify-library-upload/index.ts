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
    const { university, department, level, courseCode, fileName, uploadedByName } = await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find all users in the same university/department/level
    const { data: matchingUsers } = await serviceClient
      .from("user_settings")
      .select("user_id, fcm_token")
      .eq("university", university)
      .eq("field_of_study", department)
      .eq("university_level", level)
      .not("fcm_token", "is", null);

    if (!matchingUsers || matchingUsers.length === 0) {
      return new Response(JSON.stringify({ message: "No users to notify" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let notifiedCount = 0;
    for (const user of matchingUsers) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            userId: user.user_id,
            title: "New Study Material 📚",
            body: `${uploadedByName || 'Your Course Rep'} uploaded "${fileName}" for ${courseCode}`,
            data: { link: "https://alphify.site/library", type: "library_upload" },
          }),
        });
        notifiedCount++;
      } catch (e) {
        console.error(`Failed to notify user ${user.user_id}:`, e);
      }
    }

    return new Response(JSON.stringify({ success: true, notifiedCount }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
