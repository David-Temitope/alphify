import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { course, examType, userLevel, fieldOfStudy, examSampleText } = await req.json();

    if (!course || !examType) {
      return new Response(JSON.stringify({ error: 'Missing course or examType' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // KU Balance Check (require >= 70 KU)
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

    if (!kuWallet || kuWallet.balance < 70) {
      return new Response(JSON.stringify({ 
        error: `You need at least 70 Knowledge Units to start an exam. You have ${kuWallet?.balance || 0} KU.`,
        code: "INSUFFICIENT_KU"
      }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct 1 KU for exam generation
    await serviceClient
      .from('ku_wallets')
      .update({ balance: kuWallet.balance - 1 })
      .eq('user_id', authData.user.id);

    await serviceClient.from('ku_transactions').insert({
      user_id: authData.user.id,
      amount: -1,
      type: 'exam_start',
      description: `Exam generation: ${course}`
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const objectiveCount = examType === 'objective' ? 50 : examType === 'both' ? 40 : 0;
    const theoryCount = examType === 'theory' ? 50 : examType === 'both' ? 10 : 0;

    const prompt = `You are an expert exam setter for ${fieldOfStudy || 'general'} students at ${userLevel || 'university'} level.

Generate a ${course} exam with EXACTLY:
${objectiveCount > 0 ? `- ${objectiveCount} objective (multiple choice) questions with options A, B, C, D` : ''}
${theoryCount > 0 ? `- ${theoryCount} theory questions (definitions, explanations, calculations, listings)` : ''}

${examSampleText ? `Use this sample exam style as a guide:\n${examSampleText}\n` : ''}

IMPORTANT FORMATTING RULES:
1. Return ONLY valid JSON, no markdown, no explanation
2. Each question must have: id, type ("objective" or "theory"), question, and for objectives: options (array of 4), correctAnswer (A/B/C/D)
3. Make questions challenging but fair for the student level
4. Mix difficulty: 30% easy, 50% medium, 20% hard
5. Cover different topics within the course

Return format:
{
  "questions": [
    {
      "id": 1,
      "type": "objective",
      "question": "What is...?",
      "options": ["A. Option1", "B. Option2", "C. Option3", "D. Option4"],
      "correctAnswer": "A",
      "marks": 1
    },
    {
      "id": 2,
      "type": "theory",
      "question": "Define and explain...",
      "marks": 2
    }
  ]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an exam generation AI. Return ONLY valid JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI rate limit exceeded. Please wait a few minutes and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const rawText = aiData.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    let examData;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        examData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch (parseError) {
      console.error("Failed to parse exam JSON:", rawText);
      return new Response(
        JSON.stringify({ error: "Failed to generate valid exam format" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: attempt, error: insertError } = await supabase
      .from('exam_attempts')
      .insert({
        user_id: authData.user.id,
        course,
        exam_type: examType,
        questions: examData.questions,
        max_score: examData.questions.reduce((sum: number, q: any) => sum + (q.marks || 1), 0),
        time_limit_minutes: 60,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create exam attempt:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save exam" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(attempt), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate exam error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
