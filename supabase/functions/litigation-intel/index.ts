// Weybre AI — Litigation Intelligence
// Combines eCourts (live court data) + Indian Kanoon (precedents) + Lovable AI
// to produce a unified case-intelligence brief.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const IK_TOKEN = Deno.env.get("INDIAN_KANOON_API_TOKEN")!;
const ECOURTS_TOKEN = Deno.env.get("ECOURTS_API_TOKEN")!;

const IK_BASE = "https://api.indiankanoon.org";
const ECOURTS_BASE = "https://webapi.ecourtsindia.com";

// ---------- helpers ----------
function stripHtml(s = ""): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------- Indian Kanoon ----------
async function ikSearch(query: string, limit = 5) {
  const params = new URLSearchParams({ formInput: query, pagenum: "0" });
  const r = await fetch(`${IK_BASE}/search/?${params}`, {
    method: "POST",
    headers: { Authorization: `Token ${IK_TOKEN}`, Accept: "application/json" },
  });
  if (!r.ok) {
    console.error("IK search error", r.status);
    return [];
  }
  const j = await r.json().catch(() => ({}));
  const docs = Array.isArray(j.docs) ? j.docs.slice(0, limit) : [];
  return docs.map((d: any) => ({
    tid: d.tid,
    title: stripHtml(d.title ?? ""),
    source: d.docsource,
    date: d.publishdate,
    cited_by: d.numcitedby ?? 0,
    headline: stripHtml(d.headline ?? "").slice(0, 800),
    url: `https://indiankanoon.org/doc/${d.tid}/`,
  }));
}

// ---------- eCourts ----------
async function ecourtsCase(cnr: string) {
  if (!ECOURTS_TOKEN) return null;
  const r = await fetch(`${ECOURTS_BASE}/api/partner/case/${cnr}`, {
    headers: { Authorization: `Bearer ${ECOURTS_TOKEN}`, Accept: "application/json" },
  });
  const text = await r.text();
  if (!r.ok) {
    console.error("eCourts case error", r.status, text.slice(0, 200));
    return { error: `eCourts ${r.status}`, raw: text.slice(0, 400) };
  }
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 400) }; }
}

async function ecourtsSearch(query: string) {
  if (!ECOURTS_TOKEN) return [];
  const params = new URLSearchParams({ query, pageSize: "10" });
  const r = await fetch(`${ECOURTS_BASE}/api/partner/search?${params}`, {
    headers: { Authorization: `Bearer ${ECOURTS_TOKEN}`, Accept: "application/json" },
  });
  if (!r.ok) {
    console.error("eCourts search error", r.status);
    return [];
  }
  const j = await r.json().catch(() => ({}));
  return Array.isArray(j.results) ? j.results : Array.isArray(j.data) ? j.data : [];
}

// ---------- AI synthesis ----------
async function synthesise(systemPrompt: string, userPrompt: string) {
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
  if (r.status === 429) throw new Error("Rate limit reached. Please retry in a moment.");
  if (r.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
  if (!r.ok) {
    const t = await r.text();
    console.error("AI error", r.status, t);
    throw new Error("AI synthesis failed");
  }
  const j = await r.json();
  return {
    text: j.choices?.[0]?.message?.content ?? "",
    tokens: j.usage?.total_tokens ?? 0,
  };
}

// ---------- main ----------
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
    const mode = (body.mode ?? "auto") as "auto" | "cnr" | "keyword" | "document";
    const cnr = String(body.cnr ?? "").trim().toUpperCase();
    const query = String(body.query ?? "").trim();
    const documentText = String(body.documentText ?? "").trim();
    const bodyLang = body.language;
    const probe = `${query} ${documentText.slice(0, 200)}`;
    const isDevanagari = /[\u0900-\u097F]/.test(probe);
    const lang: "en" | "hi" = isDevanagari ? "hi" : (bodyLang === "hi" ? "hi" : "en");
    const langDirective = lang === "hi"
      ? "Respond in Hindi (Devanagari script). Keep statute names, case names, sections, CNR and URLs in English."
      : "Respond in English.";

    let resolvedMode = mode;
    if (mode === "auto") {
      if (/^[A-Z]{4}\d{12}$/.test(cnr)) resolvedMode = "cnr";
      else if (documentText.length > 100) resolvedMode = "document";
      else if (query.length >= 5) resolvedMode = "keyword";
      else return json({ error: "Provide a CNR, a search query, or document text." }, 400);
    }

    let courtData: any = null;
    let searchQuery = query;

    // Step 1: pull live court data when CNR provided
    if (resolvedMode === "cnr") {
      if (!/^[A-Z]{4}\d{12}$/.test(cnr)) {
        return json({ error: "Invalid CNR. Expected 16 chars: 4 letters + 12 digits." }, 400);
      }
      courtData = await ecourtsCase(cnr);
      // Build precedent search query from case metadata
      const caseTitle = courtData?.case?.title ?? courtData?.title ?? "";
      const caseType = courtData?.case?.case_type ?? "";
      searchQuery = [caseTitle, caseType].filter(Boolean).join(" ").slice(0, 200) || cnr;
    } else if (resolvedMode === "document") {
      // Use first 200 words of document to find related precedents
      searchQuery = documentText.split(/\s+/).slice(0, 50).join(" ");
    }

    // Step 2: precedents from Indian Kanoon
    const precedents = searchQuery ? await ikSearch(searchQuery, 6) : [];

    // Step 3: court-records cross-reference (only for keyword mode)
    let liveCases: any[] = [];
    if (resolvedMode === "keyword" && query) {
      liveCases = await ecourtsSearch(query).then(r => r.slice(0, 5));
    }

    // Step 4: synthesise intelligence brief
    const precedentContext = precedents.map((p, i) =>
      `[${i + 1}] ${p.title}\nSource: ${p.source ?? "—"} | Date: ${p.date ?? "—"} | Cited by: ${p.cited_by}\nURL: ${p.url}\nExcerpt: ${p.headline}`
    ).join("\n\n---\n\n");

    const courtContext = courtData
      ? `LIVE COURT RECORD (eCourts):\n${JSON.stringify(courtData, null, 2).slice(0, 4000)}`
      : "(no live court record retrieved)";

    const docContext = documentText
      ? `\n\nUPLOADED DOCUMENT EXCERPT:\n${documentText.slice(0, 4000)}`
      : "";

    const systemPrompt = `You are Weybre AI's Litigation Intelligence engine for Indian advocates and law firms.
You receive: (a) live eCourts data, (b) Indian Kanoon precedents, (c) optional uploaded document text, (d) the user's case query.

Write like a senior advocate briefing a colleague — clean prose, minimal scaffolding.
Format rules: no headings, no bold, no horizontal rules, no emoji. Plain paragraphs. Use a short bullet list only when listing 3+ discrete items (precedents, next steps, risk flags).

Cover, in this order, as natural prose:
- A one-paragraph case snapshot (parties, court, stage, last hearing if known).
- The key legal issues.
- The most relevant precedents with [n] citations and how each applies.
- Hearing & procedural status from eCourts if present, else state plainly that CNR is needed for live tracking.
- A short take on how this court/judge typically rules in similar matters.
- 3-5 concrete next steps — filings, sections to invoke, evidence, deadlines.
- Drafting hooks (headings, prayer clauses, notice points) the lawyer can copy.
- Risk flags — limitations, jurisdictional issues, weaknesses.

Keep it tight (≤ 500 words). End with one short line: "Verify before filing — AI-generated, not legal advice."

Language: ${langDirective}`;

    const userPrompt = `USER QUERY:\n${query || cnr || "(document-driven request)"}\n\n${courtContext}\n\nPRECEDENTS (Indian Kanoon):\n${precedentContext || "(none retrieved)"}${docContext}`;

    const ai = await synthesise(systemPrompt, userPrompt);

    // Best-effort usage log
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    await admin.from("usage_events").insert({
      user_id: user.id,
      event_type: "litigation_intel",
      tokens: ai.tokens,
      metadata: {
        mode: resolvedMode,
        cnr: cnr || null,
        query: query.slice(0, 200),
        precedents: precedents.length,
        live_cases: liveCases.length,
        had_court_data: !!courtData && !courtData.error,
      },
    });

    return json({
      mode: resolvedMode,
      brief: ai.text,
      court_data: courtData,
      precedents,
      live_cases: liveCases,
      query: searchQuery,
    });
  } catch (e) {
    console.error("litigation-intel error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
