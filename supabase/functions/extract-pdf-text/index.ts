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
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pdfBase64, mimeType } = await req.json();

    if (!pdfBase64) {
      return new Response(JSON.stringify({ error: "No PDF data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // 20MB base64 limit
    if (pdfBase64.length > 28000000) {
      return new Response(JSON.stringify({ error: "PDF too large. Maximum size is 20MB." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validMimeType = mimeType === 'application/pdf' ? mimeType : 'application/pdf';
    const dataUrl = `data:${validMimeType};base64,${pdfBase64}`;

    const extractionPrompt = `You are a precise document text extractor. Extract ALL text content from this PDF document.

INSTRUCTIONS:
1. Go through EVERY page of the document
2. For each page, output: "=== PAGE [number] ===" followed by all text on that page
3. At the START, identify the document structure:
   - Which pages are title/cover pages (containing document title, author names, institution, date, etc.)
   - Which pages are table of contents
   - Which pages contain ACTUAL COURSE CONTENT (lectures, explanations, topics)
4. Output a summary line at the very beginning: "DOCUMENT STRUCTURE: Title/cover pages: [page numbers]. Table of contents: [page numbers]. Content starts at: page [number]."
5. Extract text EXACTLY as it appears - do NOT paraphrase, summarize, or add your own content
6. Preserve headings, subheadings, numbered lists, and structure
7. If a page has images/diagrams, describe them briefly as [FIGURE: description]

Be thorough and accurate. Every word matters.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
              {
                type: "text",
                text: extractionPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("PDF extraction error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error("Failed to extract PDF text");
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    // Estimate page count from markers
    const pageMatches = text.match(/=== PAGE \d+ ===/g);
    const pageCount = pageMatches ? pageMatches.length : 1;

    return new Response(JSON.stringify({ text, pageCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("PDF extraction error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
