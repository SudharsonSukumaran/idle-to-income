import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate request body
    const body = await req.json();
    const issue_type = typeof body.issue_type === "string" ? body.issue_type.slice(0, 200) : "";
    const description = typeof body.description === "string" ? body.description.slice(0, 500) : "";
    const estimated_lost_revenue = typeof body.estimated_lost_revenue === "number"
      ? Math.max(0, Math.min(body.estimated_lost_revenue, 1_000_000))
      : 0;

    if (!issue_type || !description) {
      return new Response(
        JSON.stringify({ error: "issue_type and description are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const prompt = `You are a senior hospitality revenue management consultant writing recommendations for a product demo.

Analyze the following issue and return EXACTLY 3 lines in this format. Do not use markdown, bullet points, numbering, asterisks, or any extra text. Each line must be a complete, professional sentence.

Action: <a clear, professional action statement that addresses the root cause of the issue>
Change: <a specific operational or pricing change to implement, referencing the issue context>
Recovery: <the expected dollar recovery amount with a short business justification>

Style guide:
- Write as if presenting to a hotel operations team.
- Each line should be concise but meaningful — not a keyword or fragment.
- Mention the issue type and context naturally within the sentences.
- The Recovery line must reference the estimated lost revenue and explain how much can be recovered and why.

Issue type: ${issue_type}
Description: ${description}
Estimated lost revenue: $${estimated_lost_revenue}

Example output:
Action: Launch a targeted promotional offer to improve utilization for this underfilled inventory.
Change: Consolidate low-demand dates and introduce a limited-time discount or bundled package to increase booking conversion.
Recovery: Estimated recovery is $240 by improving occupancy across fragmented availability and reducing unsold capacity.

Now generate your 3-line recommendation for the issue above. Output only those 3 lines, nothing else.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 400, temperature: 0.4 },
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
