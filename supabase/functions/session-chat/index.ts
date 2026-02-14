import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
- Address students by their preferred names when available

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sessionId, message, topic, course } = await req.json();
    
    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid session ID' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (!message || typeof message !== 'string' || message.length > 10000) {
      return new Response(JSON.stringify({ error: 'Invalid or too long message' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Fetch participant context
    let participantContext = "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (SUPABASE_URL && serviceRoleKey) {
      const serviceClient = createClient(SUPABASE_URL, serviceRoleKey);
      
      const { data: participants } = await serviceClient
        .from("session_participants")
        .select("user_id")
        .eq("session_id", sessionId)
        .eq("is_active", true);
      
      if (participants && participants.length > 0) {
        const userIds = participants.map(p => p.user_id);
        
        const { data: settings } = await serviceClient
          .from("user_settings")
          .select("preferred_name, field_of_study, university_level, explanation_style, courses, exam_sample_text")
          .in("user_id", userIds);
        
        if (settings && settings.length > 0) {
          const preferredNames = settings.map(s => s.preferred_name).filter(Boolean);
          const fieldsOfStudy = [...new Set(settings.map(s => s.field_of_study).filter(Boolean))];
          const universityLevels = [...new Set(settings.map(s => s.university_level).filter(Boolean))];
          const explanationStyles = settings.map(s => s.explanation_style).filter(Boolean);
          const allCourses = [...new Set(settings.flatMap(s => s.courses || []))];
          const examSamples = settings.map(s => s.exam_sample_text).filter(Boolean);
          
          const styleCounts: Record<string, number> = {};
          explanationStyles.forEach(style => {
            styleCounts[style] = (styleCounts[style] || 0) + 1;
          });
          const dominantStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "five_year_old";
          
          let examSampleContext = "";
          if (examSamples.length > 0) {
            examSampleContext = `\n\n## Exam Question Style Reference
The participants have provided sample exam questions from their professors. When generating quizzes or exams, follow this style:\n\n${examSamples.join("\n\n---\n\n")}`;
          }

          participantContext = `
## Students in this Session
- Students: ${preferredNames.length > 0 ? preferredNames.join(", ") : "Several students"}
- Fields of Study: ${fieldsOfStudy.join(", ") || "Various fields"}
- University Levels: ${universityLevels.join(", ") || "Various levels"}
- Preferred Explanation Style: ${dominantStyle === "five_year_old" ? "Simple, like explaining to a 5-year-old" : dominantStyle === "professional" ? "Professional/Academic" : dominantStyle === "complete_beginner" ? "Complete beginner (start from basics)" : "Visual learner (use diagrams and visual descriptions)"}
- Relevant Courses: ${allCourses.length > 0 ? allCourses.slice(0, 10).join(", ") : "General academics"}
${examSampleContext}

Personalize your teaching for this group. Use their names when addressing them, and adapt your explanations to their collective background.`;
        }
      }
    }

    const systemPrompt = `${GIDEON_SESSION_PROMPT}

## Current Session
- Topic: ${topic}
- Course: ${course}
${participantContext}

Stay strictly focused on this topic. Help students understand ${topic} thoroughly.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
