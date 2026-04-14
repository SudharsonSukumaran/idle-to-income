import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { issue_type, description, estimated_lost_revenue } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const prompt = `You are a hospitality revenue management expert. Analyze this issue and respond with EXACTLY 3 lines in this format — no extra text, no bullet points, no numbering:

Action: <what to do>
Change: <what specific change to apply>
Recovery: <estimated dollar amount recoverable and difficulty Easy/Medium/Hard>

Issue type: ${issue_type}
Description: ${description}
Estimated lost revenue: $${estimated_lost_revenue}

Respond with exactly those 3 lines. Do not add any other text.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.3 },
        }),
      }
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({ recommendation: `API error: ${response.status}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No AI response generated";

    return new Response(
      JSON.stringify({ recommendation: text }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-recommendation error:", e);
    return new Response(
      JSON.stringify({ recommendation: `Error: ${e instanceof Error ? e.message : "Unknown"}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
