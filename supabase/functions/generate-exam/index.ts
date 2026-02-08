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

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    if (!GOOGLE_API_KEY) {
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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

    let response: Response | null = null;
    let errorText = "";

    for (let attempt = 0; attempt < 2; attempt++) {
      response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (response.ok) break;

      errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);

      if (response.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      break;
    }

    if (!response || !response.ok) {
      if (response?.status === 429) {
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

    const geminiData = await response.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response (might be wrapped in markdown)
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

    // Create exam attempt record
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
