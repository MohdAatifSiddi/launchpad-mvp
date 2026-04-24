// Draft edge function: chat-driven contract/document generation
// with risk flags, grounded in Indian SC judgments where applicable.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const TEMPLATE_GUIDES: Record<string, string> = {
  nda: "Mutual or one-way Non-Disclosure Agreement under Indian Contract Act 1872. Include: parties, purpose, definition of confidential information, exclusions, obligations, term (typically 2-3 years), return/destruction, remedies (injunction + damages), governing law (Indian), jurisdiction, dispute resolution (arbitration under Arbitration & Conciliation Act 1996 or courts).",
  employment: "Employment Agreement compliant with Industrial Employment (Standing Orders) Act, Shops & Establishment Act of relevant state, Code on Wages 2019, EPF, ESI, gratuity. Include: appointment, designation, duties, compensation (basic + allowances + variable), probation, working hours, leave (CL/SL/EL), confidentiality, non-compete (note Section 27 ICA enforceability limits), IP assignment, termination, notice period, full & final settlement.",
  service: "Service Agreement / Professional Services Agreement. Include: scope of services, deliverables, fees & GST, payment terms, IP ownership, confidentiality, indemnity, limitation of liability, term, termination, force majeure, governing law, dispute resolution.",
  legal_notice: "Legal Notice under Section 80 CPC (if against govt) or general civil/commercial. Include: sender's advocate details, recipient details, factual background, cause of action, specific demand, statutory time period (15-60 days), consequences of non-compliance.",
  reply_notice: "Reply to Legal Notice. Include: paragraph-wise denial/admission of allegations, affirmative defences, counter-claims if any, request to withdraw, signature of advocate.",
  vakalatnama: "Vakalatnama under Order III CPC / Supreme Court Rules. Include: parties, court, case number, advocate(s) name, enrollment number, address for service, scope of authority, signature of client and advocate, certificate of advocate.",
};

// Lovable AI Gateway does not yet expose embeddings; use a zero vector
// so search_judgments falls back to keyword-only retrieval.
function zeroEmbedding(): number[] {
  return new Array(1536).fill(0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { template, title, conversation, existing_content } = await req.json();
    if (!template || !TEMPLATE_GUIDES[template]) {
      return json({ error: "Invalid template" }, 400);
    }
    if (!Array.isArray(conversation) || conversation.length === 0) {
      return json({ error: "Conversation required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Pull a few relevant SC cases to ground risk flags
    const lastUserMsg = [...conversation].reverse().find((m: any) => m.role === "user")?.content ?? "";
    const groundQuery = `${template} ${title ?? ""} ${lastUserMsg}`.slice(0, 800);
    const queryEmbedding = await embed(groundQuery);
    const { data: judgments } = await admin.rpc("search_judgments", {
      query_text: groundQuery,
      query_embedding: `[${queryEmbedding.join(",")}]`,
      match_count: 4,
    });
    const groundContext = (judgments ?? []).map((c: any) =>
      `- ${c.title} (${c.neutral_citation || c.citation || "—"}): ${(c.headnote ?? c.summary ?? "").slice(0, 400)}`
    ).join("\n");

    const systemPrompt = `You are NyayAI, an Indian legal drafting assistant. Generate professional, courtroom-ready drafts for Indian lawyers.

TEMPLATE: ${template}
GUIDE: ${TEMPLATE_GUIDES[template]}

RELEVANT SUPREME COURT PRECEDENTS (use to inform risk flags):
${groundContext || "(none retrieved)"}

RULES:
1. Generate the FULL document in plain text with proper Indian legal formatting (numbered clauses, ALL CAPS for headings, "WHEREAS" recitals where appropriate).
2. Use Indian Rupees (₹), Indian dates (DD-MM-YYYY), Indian addresses, GST where relevant.
3. If the user has not provided enough information, ask 1-3 specific follow-up questions in your reply, but STILL generate a best-effort draft with [PLACEHOLDER] markers.
4. Identify risk_flags for clauses that could be unenforceable, ambiguous, or carry liability — especially under Section 27 ICA (restraint of trade), Section 23 ICA (public policy), DPDP Act 2023, Stamp Act requirements, registration requirements.

Return ONLY a JSON object via the function tool, no prose.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          ...(existing_content ? [{ role: "assistant", content: `Current draft so far:\n\n${existing_content.slice(0, 8000)}` }] : []),
          ...conversation,
        ],
        tools: [{
          type: "function",
          function: {
            name: "produce_draft",
            description: "Return the updated draft, a short chat reply, and risk flags.",
            parameters: {
              type: "object",
              properties: {
                reply: { type: "string", description: "Conversational reply to the lawyer (1-3 short sentences). Mention any [PLACEHOLDER] fields needing input." },
                content: { type: "string", description: "The full updated document in plain text with numbered clauses." },
                risk_flags: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      clause: { type: "string", description: "Short clause identifier, e.g. 'Clause 7 (Non-compete)'." },
                      severity: { type: "string", enum: ["low", "medium", "high"] },
                      note: { type: "string", description: "Plain-English risk explanation, citing the Indian statute or precedent." },
                    },
                    required: ["clause", "severity", "note"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["reply", "content", "risk_flags"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "produce_draft" } },
      }),
    });

    if (r.status === 429) return json({ error: "Rate limit reached. Please try again." }, 429);
    if (r.status === 402) return json({ error: "AI credits exhausted." }, 402);
    if (!r.ok) {
      console.error("draft AI error", r.status, await r.text());
      return json({ error: "AI drafting failed" }, 500);
    }

    const j = await r.json();
    const toolCall = j.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "No draft produced" }, 500);

    let parsed: { reply: string; content: string; risk_flags: any[] };
    try { parsed = JSON.parse(toolCall.function.arguments); }
    catch { return json({ error: "Invalid AI output" }, 500); }

    await admin.from("usage_events").insert({
      user_id: user.id,
      event_type: "draft_generation",
      tokens: j.usage?.total_tokens ?? 0,
      metadata: { template, title },
    });

    return json(parsed);
  } catch (e) {
    console.error("draft error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
