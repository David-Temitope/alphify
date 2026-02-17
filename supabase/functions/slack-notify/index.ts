import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function sendSlackMessage(channel: string, text: string, username?: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured, skipping Slack notification");
    return;
  }

  const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
  if (!SLACK_API_KEY) {
    console.error("SLACK_API_KEY not configured, skipping Slack notification");
    return;
  }

  try {
    const response = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": SLACK_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        text,
        username: username || "Alphify Bot",
        icon_emoji: ":books:",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(`Slack API error [${response.status}]:`, JSON.stringify(data));
    } else {
      console.log("Slack message sent successfully");
    }
    return data;
  } catch (error) {
    console.error("Failed to send Slack message:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event, data } = await req.json();

    // Default channel - can be configured
    const channel = Deno.env.get("SLACK_CHANNEL") || "#general";

    let message = "";

    switch (event) {
      case "new_user":
        message = `🎉 *New user signed up!*\nEmail: ${data.email}\nWelcome bonus: 3 KU credited`;
        break;
      case "payment_success":
        message = `💰 *Payment received!*\nUser: ${data.email}\nAmount: ₦${(data.amount / 100).toLocaleString()}\nUnits: ${data.units} KU\nTarget: ${data.target}`;
        break;
      case "group_created":
        message = `👥 *New study group created!*\nGroup: ${data.groupName}\nMembers: ${data.memberCount}`;
        break;
      case "session_started":
        message = `📚 *Study session started!*\nGroup: ${data.groupName}\nTopic: ${data.topic}\nCourse: ${data.course}`;
        break;
      case "file_uploaded":
        message = `📄 *File uploaded!*\nFile: ${data.fileName}\nType: ${data.type}\nBy: ${data.email || "Unknown"}`;
        break;
      default:
        message = `📢 Event: ${event}\n${JSON.stringify(data, null, 2)}`;
    }

    await sendSlackMessage(channel, message);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in slack-notify:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
