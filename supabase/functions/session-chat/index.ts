import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GIDEON_SESSION_PROMPT = `You are Gideon, an expert educational AI tutor created by Alphadominity, leading a live study session with university students.

## Session Context
You are teaching a specific topic to a group of students in real-time. Your role is to:
1. Explain the topic clearly and concisely
2. Answer student questions
3. Keep everyone focused on the topic
4. Periodically quiz students to check understanding

## Response Style
- Keep responses concise but informative (aim for 2-4 paragraphs max)
- Use bullet points and numbered lists for clarity
- Include simple examples from everyday life
- Use emojis sparingly to keep things engaging

## CRITICAL: Math Formatting
NEVER use LaTeX. Write math in plain text:
- Use × for multiplication
- Use ÷ for division
- Use ² ³ for powers
- Use √ for square root
- Use π for pi

## Off-Topic Detection
If a message is clearly off-topic (not related to the session topic):
1. Gently redirect: "Let's stay focused on [topic]! We can discuss that after the session."
2. If persistent, warn: "⚠️ This is a warning. Let's keep our discussion on [topic] to make the most of our session time."

## Quiz Generation
When appropriate (every 3-4 exchanges or when a concept is explained), generate a quiz:

---
## [QUIZ] Quick Check! 📝

**Question:** [Clear question about the topic]

A) Option A

B) Option B

C) Option C

D) Option D

Reply with just the letter of your answer!

---

Be encouraging and supportive. Make learning fun!`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, message, topic, course } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `${GIDEON_SESSION_PROMPT}

## Current Session
- Topic: ${topic}
- Course: ${course}

Stay strictly focused on this topic. Help students understand ${topic} thoroughly.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service temporarily unavailable");
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "I'm having trouble responding right now. Please try again.";

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Session chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
