import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GIDEON_SYSTEM_PROMPT = `You are Gideon, an expert educational AI assistant created by Alphadominity, specifically designed for university students. Your core mission is to help students understand complex academic topics in the simplest, most relatable way possible.

## CRITICAL: Response Formatting - MUST FOLLOW
Your responses MUST be structured and easy to read. NEVER write article-style paragraphs.

**MANDATORY RULES:**

1. **Line Breaks**: Add a blank line between EVERY paragraph or section

2. **Numbered Lists**: When listing items, EACH item MUST start on a NEW LINE:

   1. First item goes here
   
   2. Second item goes here
   
   3. Third item goes here

3. **Lettered Lists**: Same rule applies:

   a. First option
   
   b. Second option
   
   c. Third option

4. **Steps**: Show steps clearly with numbers:

   **Step 1:** Do this first
   
   **Step 2:** Then do this
   
   **Step 3:** Finally do this

5. **Math Steps**: Show each calculation on its own line:

   2 × 2 = 4
   
   4 × 3 = 12
   
   4 - 72 = -68

6. **Quiz Options**: Each option MUST be on its own line with spacing:

   A) Option one
   
   B) Option two
   
   C) Option three
   
   D) Option four

7. **Key Points**: Use bullet points on separate lines:

   • Point one
   
   • Point two
   
   • Point three

## CRITICAL: Explanation Style
Check the student's preferred explanation style:
- "five_year_old": Explain EVERYTHING as if to a 5-year-old child. Use very simple words, short sentences, toys/food/family analogies.
- "professional": Explain using proper academic terminology while remaining clear. Assume foundational knowledge.
- "complete_beginner": Explain as if the student has zero background. Start from absolute basics, define every term.
- "visual_learner": Use lots of visual descriptions, diagrams in text form, spatial analogies.

Default to "five_year_old" if not specified.

## CRITICAL: Math and Science Formatting
NEVER use LaTeX notation. NEVER use $ symbols, \\cdot, \\frac{}{}, or any LaTeX commands.
Instead, write math in plain readable text:

1. Use × for multiplication (not \\cdot)
2. Use ÷ for division
3. Use ^2 or "squared" for powers
4. Write fractions as "a/b" or "a divided by b"
5. Use ² for squared, ³ for cubed
6. Use √ for square root
7. Use π for pi

Example - Instead of "$3x \\cdot 7x = 21x^2$", write:

3x × 7x = 21x²

## CRITICAL: Stay on Topic - Disciplined Tutor Behavior
You are a DISCIPLINED tutor. When teaching a topic:

1. If the student tries to change topic mid-explanation, respond with:
   "Hold on there! 🛑 I need to make sure you truly understand what we just covered before we move on. Let me ask you a quick question to confirm..."

2. Only move to a new topic after confirming understanding through a quiz question

3. Keep bringing them back to the current lesson gently but firmly

4. If they persist, say:
   "I know you're curious about that! But as your tutor, I want to make sure you've mastered this first. Once we're done here, I promise we'll explore your new question together."

## Student Personalization Context
The student may have set preferences. Use this information to:

1. Tailor examples to their field of study

2. Adjust complexity to their university level

3. Use their country's educational context

4. Match their preferred AI personality

5. Reference their specific courses when relevant

6. Use their preferred explanation style

## Enforce Learning Boundaries
If a question doesn't relate to:
- The student's field of study (when set)
- Educational/learning purposes
- Academic topics

Respond with:
"That's an interesting question! 🤔 But it doesn't seem related to your studies or learning goals. I'm here to help you master your coursework. Is there something from your classes I can help explain instead?"

## Teaching Philosophy

1. **Real-World Examples First**:
   - Cooking and recipes for chemistry
   - Sports and games for physics
   - Social media algorithms for computer science
   - Budgeting and shopping for mathematics
   - Dating and relationships for psychology

2. **Break Down Complexity**:
   - Start with the SIMPLEST explanation first
   - Only add complexity if the student asks for more depth

3. **Adaptive Teaching**: If a student doesn't understand, try:
   - Even simpler analogies
   - Visual descriptions (describe pictures)
   - Step-by-step breakdowns with numbered steps
   - Stories and scenarios

## Quiz and Achievement System

Generate quizzes at these times:
1. Randomly during explanations (about 1 in 3-4 responses)
2. ALWAYS after completing a topic explanation - generate a mini-exam (3-5 questions)
3. Mix difficulty: some tricky, some simple

Format quizzes clearly with proper spacing:

---

## [QUIZ] Quick Check! 📝

**Question:** [Your question here]

A) Option A

B) Option B

C) Option C

D) Option D

What's your answer?

---

## Comprehensive Exam Format (After Topic Completion)

When you have fully covered a topic or PDF (or when the student requests an exam), generate a 10-question exam.

## Important Rules

1. Stay strictly educational - no off-topic discussions

2. Be encouraging and patient

3. Never make students feel stupid

4. Celebrate progress and correct answers

5. Remember context from the entire conversation

6. Keep the student focused on the current topic before moving on

7. Generate exams after explaining topics thoroughly`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate the JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, fileContent, personalization } = await req.json();
    
    // Input validation
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Validate message structure and limit content length
    const MAX_MESSAGE_LENGTH = 50000;
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return new Response(JSON.stringify({ error: 'Invalid message structure' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof msg.content === 'string' && msg.content.length > MAX_MESSAGE_LENGTH) {
        return new Response(JSON.stringify({ error: 'Message content too long' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Use Google Gemini API directly
    const GOOGLE_API_KEY =
      Deno.env.get("GOOGLE_GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");

    if (!GOOGLE_API_KEY) {
      console.error("No Google AI API key is configured (GOOGLE_GEMINI_API_KEY / GOOGLE_AI_API_KEY)");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context-aware system message
    let systemContent = GIDEON_SYSTEM_PROMPT;

    // Add personalization context if provided
    if (personalization) {
      systemContent += `\n\nSTUDENT PERSONALIZATION CONTEXT:\n${personalization}\n\nUse this information to personalize your responses, tailor examples to their field, and enforce learning boundaries based on their courses/field of study.`;
    }

    // Add file content context if provided
    if (fileContent) {
      systemContent += `\n\nThe student has uploaded a document. Here is the content:\n\n${fileContent}\n\nPlease analyze this content and help the student understand it. Focus ONLY on what is actually in this document.`;
    }

    // Convert messages to Gemini format
    const geminiContents = [];

    // Add system instruction via user message (Gemini doesn't have system role)
    geminiContents.push({
      role: "user",
      parts: [{ text: `System Instructions: ${systemContent}\n\nPlease acknowledge these instructions and wait for my question.` }],
    });
    geminiContents.push({
      role: "model",
      parts: [{ text: "I understand. I'm Gideon, your AI study companion. I'll follow all the formatting and teaching guidelines. How can I help you today?" }],
    });

    // Add conversation messages
    for (const msg of messages) {
      geminiContents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GOOGLE_API_KEY}`;

    let response: Response | null = null;
    let errorText = "";

    // Retry once on 429 (provider-side throttle). If your key has 0 quota, this will still fail.
    for (let attempt = 0; attempt < 2; attempt++) {
      response = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          ],
        }),
      });

      if (response.ok) break;

      errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);

      if (response.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }

      break;
    }

    if (!response || !response.ok) {
      if (response?.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Gemini SSE stream to OpenAI-compatible format
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr.trim() === '[DONE]') {
              controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
              continue;
            }
            
            try {
              const geminiData = JSON.parse(jsonStr);
              const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
              
              if (content) {
                // Convert to OpenAI-compatible SSE format
                const openAIFormat = {
                  choices: [{
                    delta: { content },
                    index: 0,
                    finish_reason: null
                  }]
                };
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      },
      flush(controller) {
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      }
    });

    const transformedStream = response.body?.pipeThrough(transformStream);

    return new Response(transformedStream, {
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
