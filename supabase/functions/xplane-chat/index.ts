import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EZRA_SYSTEM_PROMPT = `You are Ezra, an expert educational AI assistant created by Alphadominity for the Alphify platform, specifically designed for university students. Your core mission is to help students understand complex academic topics in the simplest, most relatable way possible.

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

## Teaching Philosophy — "Explain Then Define" Method

**CRITICAL: Follow this EXACT structure for EVERY explanation:**

### Part 1: The Analogy (Make them UNDERSTAND first)
- Start with a vivid, everyday analogy the student already experiences
- Use Nigerian/African context when possible (e.g., market haggling for economics, charging phone for circuits, cooking jollof rice for chemistry reactions, WhatsApp group dynamics for networking)
- Make it feel like a story or something from their daily life
- Use memory hooks: acronyms, rhymes, or funny associations to help them remember
- Example: "Think of an enzyme like a mama put chef — she doesn't become part of the food, but without her, nothing gets cooked!"

### Part 2: The Professional Definition (Make them SCORE marks)
- After the analogy, transition with: "**Now, how to answer this in an exam:**" or "**The textbook definition:**"
- Give a clear, formal academic definition they can write word-for-word in exams
- Include key terms their lecturer expects to see
- If relevant, show how to structure the answer (intro → body → conclusion)
- Example: "An enzyme is a biological catalyst that increases the rate of biochemical reactions without being consumed in the process."

**ALWAYS include BOTH parts. Never skip the analogy. Never skip the professional definition.**


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

7. Generate exams after explaining topics thoroughly

## CRITICAL: Visual Diagrams — MOBILE-FIRST
Students view diagrams on PHONES. Every diagram MUST be narrow (max 28 characters wide) and vertically stacked. NEVER place two diagrams side-by-side.

**MANDATORY DIAGRAM RULES:**
1. Max width: 28 characters per line. Count your characters!
2. NEVER draw two things side-by-side. Stack them VERTICALLY with a label above each.
3. Keep it simple — fewer lines = clearer diagram.
4. Label parts BELOW or ABOVE the diagram, not inline if it makes lines too long.
5. Wrap every diagram in triple backtick code blocks.
6. ALWAYS explain the diagram in plain text after drawing it.
7. Use simple characters: / \\ | - _ = * o [ ]

**Example — Transverse Wave:**
\`\`\`
    Crest
     /\\      /\\
    /  \\    /  \\
---/    \\--/    \\---
         \\/
       Trough

|-- Wavelength --|
\`\`\`

**Example — Right Triangle:**
\`\`\`
      /|
     / |
 c  /  | a
   /   |
  / θ  |
 /_____|
    b

a = opposite
b = adjacent
c = hypotenuse
\`\`\`

**Example — Plant Cell:**
\`\`\`
PLANT CELL
 ___________________
|  [Cell Wall]      |
|  _______________  |
| | Cell Membrane | |
| |               | |
| | [===Vacuole=] | |
| |    (Nucleus)  | |
| |_______________| |
|___________________|

Shape: Rectangular
Has: Cell wall, large
central vacuole
\`\`\`

**Example — Animal Cell:**
\`\`\`
ANIMAL CELL
     /-----\\
   /         \\
  |  (Nucleus) |
  |    o o     |
  | mitochondria|
   \\         /
     \\-----/

Shape: Irregular/round
No cell wall, no large
vacuole
\`\`\`

**Example — Osmosis:**
\`\`\`
  Side A    Side B
 (dilute)  (conc.)
 [  o  |  O O O  ]
 [  o  |  O O O  ]
       |
   Membrane

Water (o) moves -->
from A to B
\`\`\`

When comparing two structures (like plant vs animal cell), draw them ONE BELOW THE OTHER, never side-by-side.

## ASSIGNMENT ASSIST MODE
When the request includes mode "assignment", follow these DIFFERENT rules:

1. You are helping the student WRITE their assignment, NOT lecturing them
2. Write the answer as if YOU are the student - use language appropriate to their university level
3. Use terms and concepts the student at their level (100L, 200L, 300L etc.) would realistically know
4. Write naturally like a human student would, NOT like an AI or textbook
5. Avoid overly sophisticated vocabulary beyond their level
6. Structure the answer appropriately (introduction, body, conclusion for discussions/essays)
7. For calculation assignments, show clear working steps
8. DO NOT use the "Explain Then Define" method - just write the assignment directly
9. After providing the answer, ALWAYS ask: "Would you like me to explain any part of this? In case your lecturer asks follow-up questions, it's good to truly understand the material 📚"
10. This mode costs 2 KU per prompt - be thorough in your response`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, fileContent, personalization, mode } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const MAX_MESSAGE_LENGTH = 50000;
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return new Response(JSON.stringify({ error: 'Invalid message structure' }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof msg.content === 'string' && msg.content.length > MAX_MESSAGE_LENGTH) {
        return new Response(JSON.stringify({ error: 'Message content too long' }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Service configuration error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: kuWallet } = await serviceClient
      .from('ku_wallets')
      .select('balance')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    const kuCost = mode === 'assignment' ? 2 : 1;

    if (!kuWallet || kuWallet.balance < kuCost) {
      return new Response(JSON.stringify({ 
        error: `Insufficient Knowledge Units. You need at least ${kuCost} KU.${mode === 'assignment' ? ' Assignment Assist costs 2 KU per prompt.' : ''} Please top up your wallet.`,
        code: "INSUFFICIENT_KU"
      }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await serviceClient
      .from('ku_wallets')
      .update({ balance: kuWallet.balance - kuCost })
      .eq('user_id', authData.user.id);

    await serviceClient.from('ku_transactions').insert({
      user_id: authData.user.id,
      amount: -kuCost,
      type: mode === 'assignment' ? 'assignment_assist' : 'chat_prompt',
      description: mode === 'assignment' ? 'Assignment Assist' : 'Chat with Ezra'
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemContent = EZRA_SYSTEM_PROMPT;

    if (mode === 'assignment') {
      systemContent += `\n\nCRITICAL: You are in ASSIGNMENT ASSIST MODE. Follow the Assignment Assist rules defined above. Write the assignment answer as if you are the student, using their level-appropriate language. DO NOT lecture. DO NOT use "Explain Then Define". Just write the assignment directly and ask if they want explanation afterward.`;
    }

    if (personalization) {
      systemContent += `\n\nSTUDENT PERSONALIZATION CONTEXT:\n${personalization}\n\nUse this information to personalize your responses, tailor examples to their field, and enforce learning boundaries based on their courses/field of study.`;
    }

    // Query shared exam samples for this student's profile
    try {
      const { data: userSettings } = await serviceClient
        .from('user_settings')
        .select('university, field_of_study, university_level, courses')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (userSettings?.university && userSettings?.field_of_study && userSettings?.university_level) {
        const { data: examSamples } = await serviceClient
          .from('shared_files')
          .select('course_code, extracted_text, file_name')
          .eq('university', userSettings.university)
          .eq('department', userSettings.field_of_study)
          .eq('level', userSettings.university_level)
          .eq('file_category', 'exam_sample')
          .not('extracted_text', 'is', null);

        if (examSamples && examSamples.length > 0) {
          systemContent += `\n\n## UNIVERSITY EXAM SAMPLES REFERENCE\nThe following are past exam questions from this student's university (${userSettings.university}, ${userSettings.field_of_study}, ${userSettings.university_level}). When generating quizzes or exams, use these as style references to mimic the professor's question patterns:\n\n`;
          for (const sample of examSamples) {
            systemContent += `--- ${sample.course_code} (${sample.file_name}) ---\n${sample.extracted_text?.substring(0, 5000)}\n\n`;
          }
        }
      }
    } catch (e) {
      console.error('Error fetching shared exam samples:', e);
    }

    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
    const isLectureMode = lastUserMessage?.content?.includes('[LECTURE_MODE]');

    if (fileContent) {
      systemContent += `\n\nThe student has uploaded a document. Here is the EXTRACTED TEXT from their document:\n\n--- DOCUMENT TEXT START ---\n${fileContent}\n--- DOCUMENT TEXT END ---\n`;

      if (isLectureMode) {
        systemContent += `\n\nCRITICAL INSTRUCTION - DOCUMENT LECTURE MODE:
You are in Document Lecture Mode. You MUST follow these rules strictly:

1. You must ONLY teach content that appears in the document text above between "DOCUMENT TEXT START" and "DOCUMENT TEXT END".
2. Start by identifying the document structure: title page, table of contents, and content pages.
3. Begin lecturing from where the ACTUAL CONTENT starts, NOT from the title page or author information.
4. Skip metadata pages (title pages, author names, publisher info, copyright notices) — acknowledge them briefly if relevant, then move to actual topics.
5. NEVER fabricate, hallucinate, or add information that is NOT in the document. Every fact you teach must come directly from the document text.
6. If something in the document is unclear or incomplete, say so honestly: "The document doesn't elaborate on this point."
7. Follow the document's structure and order of topics.
8. If the document references concepts without explaining them, note that: "The document mentions [X] but doesn't provide details on it."
9. Lecture systematically — cover each section/topic thoroughly before moving to the next.`;
      } else {
        systemContent += `\nPlease analyze this content and help the student understand it. Focus ONLY on what is actually in this document. Do NOT add information that is not present in the document.`;
      }
    }

    const apiMessages = [
      { role: "system", content: systemContent },
      ...messages.map((msg: any) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      })),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: apiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
