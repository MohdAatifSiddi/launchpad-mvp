// Weybre AI — Legal Decision Engine
// Pulls cases from Indian Kanoon API, then uses Lovable AI to synthesize
// actionable guidance: extracted arguments, predicted outcome, recommended actions.
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
const IK_TOKEN = Deno.env.get("INDIAN_KANOON_API_TOKEN")!;

const IK_BASE = "https://api.indiankanoon.org";

interface IKDoc {
  tid: number;
  title: string;
  headline?: string;
  docsource?: string;
  publishdate?: string;
  numcites?: number;
  numcitedby?: number;
}

async function ikSearch(query: string, pagenum = 0): Promise<IKDoc[]> {
  const params = new URLSearchParams({ formInput: query, pagenum: String(pagenum) });
  const url = `${IK_BASE}/search/?${params.toString()}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${IK_TOKEN}`,
      Accept: "application/json",
    },
  });
  const text = await r.text();
  if (!r.ok) {
    console.error("IK search error", r.status, text.slice(0, 500));
    return [];
  }
  let j: any;
  try { j = JSON.parse(text); } catch { console.error("IK non-JSON response", text.slice(0, 300)); return []; }
  console.log("IK search results:", j.docs?.length ?? 0, "for query:", query);
  return Array.isArray(j.docs) ? j.docs.slice(0, 8) : [];
}

async function ikDoc(tid: number): Promise<{ title?: string; doc?: string; citetid?: any[]; citedbytid?: any[] } | null> {
  const r = await fetch(`${IK_BASE}/doc/${tid}/`, {
    method: "POST",
    headers: { Authorization: `Token ${IK_TOKEN}` },
  });
  if (!r.ok) return null;
  return await r.json();
}

function stripHtml(s = ""): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

    if (!IK_TOKEN) return json({ error: "Indian Kanoon token not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const problem = typeof body.problem === "string" ? body.problem.trim() : "";
    const mode = body.mode === "contract" ? "contract" : body.mode === "predict" ? "predict" : "guide";
    const contractText = typeof body.contract === "string" ? body.contract.trim() : "";
    if (problem.length < 5 && contractText.length < 20) {
      return json({ error: "Describe the problem (min 5 chars) or paste a contract clause." }, 400);
    }

    const searchQuery = problem || contractText.slice(0, 200);
    const docs = await ikSearch(searchQuery);
    if (docs.length === 0) {
      return json({ error: "No matching cases found on Indian Kanoon. Try rephrasing." }, 404);
    }

    // Fetch detailed text for top 4 docs
    const top = docs.slice(0, 4);
    const detailed = await Promise.all(top.map(async (d) => {
      const full = await ikDoc(d.tid);
      const text = stripHtml(full?.doc ?? d.headline ?? "").slice(0, 3000);
      return {
        tid: d.tid,
        title: stripHtml(d.title),
        source: d.docsource,
        date: d.publishdate,
        cited_by: d.numcitedby,
        url: `https://indiankanoon.org/doc/${d.tid}/`,
        excerpt: text,
      };
    }));

    const context = detailed.map((c, i) => `[${i + 1}] ${c.title}
Court/Source: ${c.source ?? "—"} | Date: ${c.date ?? "—"} | Cited by: ${c.cited_by ?? 0}
URL: ${c.url}
Excerpt: ${c.excerpt}`).join("\n\n---\n\n");

    let systemPrompt = "";
    let userPrompt = "";

    const formatRules = `Write like a senior Indian advocate briefing a colleague — clean prose, minimal scaffolding.
Format rules: no headings, no bold, no horizontal rules, no emoji. Use a short bullet list only when listing 3+ discrete items; otherwise paragraphs. Inline [n] citations for every proposition. Keep total length tight (≤ 350 words).`;

    if (mode === "contract") {
      systemPrompt = `You are Weybre AI's contract risk analyst for Indian law. Review the clause/contract against retrieved Indian precedents.

${formatRules}

Open with a one-line risk verdict (Low / Medium / High) and the reason. Then walk through the flagged language, the risk, and a safer rewrite for each — quoting briefly. Mention the precedents relied on inline with [n]. End with one short line: "Verify before filing — AI-generated analysis."`;
      userPrompt = `CONTRACT/CLAUSE:\n${contractText}\n\nUSER CONTEXT:\n${problem || "(none)"}\n\nRETRIEVED INDIAN PRECEDENTS:\n${context}`;
    } else if (mode === "predict") {
      systemPrompt = `You are Weybre AI's outcome-prediction engine for Indian litigation. Estimate the likely outcome based ONLY on the retrieved cases.

${formatRules}

Open with a one-line estimate (Likely / Uncertain / Unlikely) and confidence (Low/Med/High). Then a short paragraph explaining the pattern across [n] cases — authority for and against. Close with 3-5 concrete next steps for the advocate. End with one short line: "Predictions are illustrative — verify before filing."`;
      userPrompt = `LEGAL PROBLEM:\n${problem}\n\nRETRIEVED INDIAN CASES:\n${context}`;
    } else {
      systemPrompt = `You are Weybre AI — an AI legal copilot for Indian advocates. Convert the user's real-world problem into actionable guidance grounded in retrieved Indian case law.

${formatRules}

Open with a 2-3 sentence direct answer. Then prose covering the key arguments the advocate can make (with [n]) and the counter-arguments to anticipate. Close with 3-5 concrete next steps — filings, sections to invoke, deadlines, evidence. End with one short line: "Verify before filing — AI-generated, not legal advice."`;
      userPrompt = `USER PROBLEM:\n${problem}\n\nRETRIEVED INDIAN CASES (Indian Kanoon):\n${context}`;
    }

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
    if (ai.status === 429) return json({ error: "Rate limit. Please retry." }, 429);
    if (ai.status === 402) return json({ error: "AI credits exhausted." }, 402);
    if (!ai.ok) {
      console.error("AI error", ai.status, await ai.text());
      return json({ error: "AI synthesis failed" }, 500);
    }
    const aj = await ai.json();
    const answer = aj.choices?.[0]?.message?.content ?? "No answer generated.";

    // Best-effort usage log
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await admin.from("usage_events").insert({
      user_id: user.id,
      event_type: "decision_engine",
      tokens: aj.usage?.total_tokens ?? 0,
      metadata: { mode, problem: problem.slice(0, 200), cases: detailed.length },
    });

    return json({
      answer,
      mode,
      cases: detailed.map((c, i) => ({ n: i + 1, ...c })),
    });
  } catch (e) {
    console.error("decision-engine error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
