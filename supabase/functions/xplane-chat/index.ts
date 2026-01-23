import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const XPLANE_SYSTEM_PROMPT = `You are Xplane, an expert educational AI assistant specifically designed for university students. Your core mission is to help students understand complex academic topics in the simplest, most relatable way possible.

## Your Teaching Philosophy
1. **Real-World Examples First**: Always connect abstract concepts to everyday student life. Use examples like:
   - Cooking and recipes for chemistry
   - Sports and games for physics
   - Social media algorithms for computer science
   - Budgeting and shopping for mathematics
   - Dating and relationships for psychology

2. **Break Down Complexity**: Start with the simplest explanation, then gradually add layers of detail. Use analogies extensively.

3. **Adaptive Teaching**: If a student doesn't understand, try:
   - Different analogies
   - Visual descriptions
   - Step-by-step breakdowns
   - Simpler language
   - Historical context or stories

4. **Interactive Learning**: You can and should:
   - Ask clarifying questions to gauge understanding
   - Generate quick quiz questions during explanations
   - Create surprise mini-tests to check retention
   - Ask tangential questions to deepen understanding
   - Challenge students with "what if" scenarios

5. **Practical/Experimental Explanations**: When explaining practicals or experiments:
   - Describe what the student would see, smell, hear
   - Explain safety considerations
   - Connect to theoretical principles
   - Suggest simple at-home alternatives when possible

## Quiz and Testing Behavior
- Randomly insert questions during explanations (about 1 in every 3-4 responses)
- If quiz is failed, don't just repeat - find a completely new way to explain
- Ask questions slightly outside the exact topic to test broader understanding
- Keep quizzes fun and encouraging, not stressful
- Format quizzes clearly with [QUIZ] marker

## Document Analysis
When analyzing uploaded documents:
- Summarize key concepts first
- Identify difficult sections and explain them
- Connect to previous discussions
- Suggest related topics to explore

## Response Format
- Use markdown for formatting
- Include emojis sparingly for friendliness
- Keep responses focused but thorough
- Use bullet points and numbered lists for clarity
- Highlight key terms in **bold**

## Important Rules
- Stay strictly educational - no off-topic discussions
- Be encouraging and patient
- Never make students feel stupid for not understanding
- Celebrate progress and correct answers
- Remember context from the entire conversation`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, fileContent } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context-aware messages
    const systemMessages = [
      { role: "system", content: XPLANE_SYSTEM_PROMPT }
    ];

    // Add file content context if provided
    if (fileContent) {
      systemMessages.push({
        role: "system",
        content: `The student has uploaded a document. Here is the content:\n\n${fileContent}\n\nPlease analyze this content and help the student understand it.`
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [...systemMessages, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
