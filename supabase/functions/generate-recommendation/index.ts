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

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    const prompt = `You are a senior hospitality revenue management consultant writing recommendations for a product demo.

You are responding to an issue of type "${issue_type}". Tailor your recommendation specifically to this pattern:
- orphan_night: focus on filling isolated single available nights between bookings.
- sub_threshold: focus on hitting minimum capacity thresholds for group/tour inventory.
- channel_mismatch: focus on reconciling availability across distribution channels.
- overbooking: focus on resolving double-bookings, guest communication, and compensation/relocation.
- room_misallocation: focus on swapping a single guest out of a double_bed room into a single_cot to free higher-value inventory.

Return EXACTLY 3 lines in this format. Do not use markdown, bullet points, numbering, asterisks, or any extra text. Each line must be a complete, professional sentence and must reference the "${issue_type}" pattern explicitly.

Action: <a clear, professional action statement that addresses the root cause of this ${issue_type} issue>
Change: <a specific operational or pricing change to implement for this ${issue_type} case>
Recovery: <the expected dollar recovery amount with a short business justification tied to ${issue_type}>

Issue type: ${issue_type}
Description: ${description}
Estimated lost revenue: $${estimated_lost_revenue}

Example output:
Action: Launch a targeted promotional offer to improve utilization for this underfilled inventory.
Change: Consolidate low-demand dates and introduce a limited-time discount or bundled package to increase booking conversion.
Recovery: Estimated recovery is $240 by improving occupancy across fragmented availability and reducing unsold capacity.

Now generate your 3-line recommendation for the ${issue_type} issue above. Output only those 3 lines, nothing else.`;

    const fetchOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.3,
      }),
    };

    const groqUrl = "https://api.groq.com/openai/v1/chat/completions";

    let response = await fetch(groqUrl, fetchOptions);

    // Retry once on 503
    if (response.status === 503) {
      await new Promise((r) => setTimeout(r, 2000));
      response = await fetch(groqUrl, fetchOptions);
      if (response.status === 503) {
        return new Response(
          JSON.stringify({ recommendation: "Groq is busy — click Generate again to retry." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ recommendation: "Error: Invalid Groq API key — check GROQ_API_KEY in secrets." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ recommendation: "Error: Rate limit — wait 30 seconds and try again." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ recommendation: `API error: ${response.status} — ${(err as any)?.error?.message || "unknown error"}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim() ?? "No AI response generated";

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
