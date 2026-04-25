// Research edge function: hybrid retrieval (semantic + keyword) over SC judgments,
// then synthesize a grounded answer with inline citations via Lovable AI Gateway.
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

// Lovable AI Gateway does not yet expose an embeddings model.
// We rely on the keyword (tsvector) half of search_judgments, which is highly
// effective for legal text. A zero vector keeps the RPC happy without polluting ranks.
function zeroEmbedding(): number[] {
  return new Array(1536).fill(0);
}

async function expandLegalQuery(query: string): Promise<string> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: "Convert an Indian legal research question into concise Supreme Court search keywords. Return only keywords and legal phrases, no explanation." },
        { role: "user", content: query },
      ],
    }),
  });
  if (!r.ok) return query;
  const j = await r.json();
  return (j.choices?.[0]?.message?.content ?? query).replace(/[\n,;]+/g, " ").slice(0, 300);
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

    const { query, matter_id } = await req.json();
    if (!query || typeof query !== "string" || query.length < 3) {
      return json({ error: "Query must be at least 3 characters" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Hybrid retrieval (keyword-only until embeddings are available)
    const queryEmbedding = zeroEmbedding();
    const { data: judgments, error: searchErr } = await admin.rpc("search_judgments", {
      query_text: query,
      query_embedding: `[${queryEmbedding.join(",")}]`,
      match_count: 8,
    });
    if (searchErr) {
      console.error("search error", searchErr);
      return json({ error: "Search failed: " + searchErr.message }, 500);
    }

    let cases = judgments ?? [];
    if (cases.length === 0) {
      const expandedQuery = await expandLegalQuery(query);
      const { data: expandedJudgments, error: expandedErr } = await admin.rpc("search_judgments", {
        query_text: expandedQuery,
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_count: 8,
      });
      if (expandedErr) console.error("expanded search error", expandedErr);
      cases = expandedJudgments ?? [];
    }

    if (cases.length === 0) {
      return json({
        answer: "I searched the Supreme Court corpus but could not identify a reliable match for this query. Try adding the statute name, section number, legal doctrine, or one known case name.",
        citations: [],
      });
    }

    // 2. Build grounded prompt
    const context = cases.map((c: any, i: number) => {
      const cite = c.neutral_citation || c.citation || `Case ${i + 1}`;
      return `[${i + 1}] ${c.title}
Citation: ${cite}
Court: ${c.court} | Bench: ${c.bench ?? "—"} | Date: ${c.decision_date ?? "—"}
${c.headnote ? `Headnote: ${c.headnote.slice(0, 1500)}` : ""}
${c.summary ? `Summary: ${c.summary.slice(0, 800)}` : ""}`;
    }).join("\n\n---\n\n");

    const systemPrompt = `You are Weybre AI, a legal research assistant for Indian lawyers. You answer questions strictly grounded in the Supreme Court of India judgments provided in CONTEXT.

RULES:
1. Cite cases inline using [1], [2], etc. matching the numbered cases in CONTEXT. Every legal proposition MUST have a citation.
2. If CONTEXT does not contain the answer, say so explicitly — do NOT invent law or cases.
3. Use Indian legal terminology (Section, Article, sub-section, lakh, crore, plaintiff/defendant or appellant/respondent as appropriate).
4. Structure: brief direct answer (2-3 sentences) → key cases with reasoning → caveats/limitations.
5. Never give legal advice — frame as "the Supreme Court has held…" not "you should…".
6. Maximum 400 words. Be precise, not verbose.`;

    const userPrompt = `QUESTION: ${query}\n\nCONTEXT (Supreme Court of India judgments):\n\n${context}\n\nAnswer the question using only the cases above, with [n] citations.`;

    // 3. Synthesize
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (r.status === 429) return json({ error: "Rate limit reached. Please try again in a moment." }, 429);
    if (r.status === 402) return json({ error: "AI credits exhausted. Please top up your workspace." }, 402);
    if (!r.ok) {
      const t = await r.text();
      console.error("AI error", r.status, t);
      return json({ error: "AI synthesis failed" }, 500);
    }

    const j = await r.json();
    const answer = j.choices?.[0]?.message?.content ?? "No answer generated.";

    const citations = cases.map((c: any, i: number) => ({
      n: i + 1,
      id: c.id,
      title: c.title,
      citation: c.neutral_citation || c.citation,
      court: c.court,
      decision_date: c.decision_date,
      bench: c.bench,
      judges: c.judges,
      headnote: c.headnote,
      summary: c.summary,
      similarity: c.similarity,
    }));

    // 4. Log usage (best-effort)
    await admin.from("usage_events").insert({
      user_id: user.id,
      event_type: "research_query",
      tokens: j.usage?.total_tokens ?? 0,
      metadata: { query, matter_id, cases: cases.length },
    });

    return json({ answer, citations });
  } catch (e) {
    console.error("research error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
