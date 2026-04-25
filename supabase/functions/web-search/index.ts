// Weybre AI — production web research with real Tavily search results + cited AI synthesis.
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
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY")!;

interface WebSource {
  n: number;
  title: string;
  url: string;
  domain: string;
  snippet?: string;
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  raw_content?: string | null;
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

    const body = await req.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (query.length < 3) return json({ error: "Query must be at least 3 characters" }, 400);
    if (!TAVILY_API_KEY) return json({ error: "Tavily API key is not configured" }, 500);

    const search = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        topic: "general",
        max_results: 8,
        include_answer: false,
        include_raw_content: false,
        include_domains: [
          "sci.gov.in",
          "main.sci.gov.in",
          "indiacode.nic.in",
          "egazette.nic.in",
          "lawmin.gov.in",
          "barcouncilofindia.org",
          "livelaw.in",
          "barandbench.com",
          "legallyindia.com",
          "taxmann.com",
          "prsindia.org",
        ],
      }),
    });

    if (search.status === 401 || search.status === 403) return json({ error: "Tavily API key was rejected" }, search.status);
    if (search.status === 429) return json({ error: "Tavily rate limit reached. Please try again shortly." }, 429);
    if (!search.ok) {
      const t = await search.text();
      console.error("Tavily error", search.status, t);
      return json({ error: "Live search failed" }, 502);
    }

    const searchJson = await search.json();
    const results: TavilyResult[] = Array.isArray(searchJson.results) ? searchJson.results : [];
    const sources: WebSource[] = results
      .filter((r) => r.url)
      .slice(0, 8)
      .map((r, i) => {
        const u = new URL(r.url!);
        return {
          n: i + 1,
          title: r.title || u.hostname,
          url: u.href,
          domain: u.hostname.replace(/^www\./, ""),
          snippet: r.content,
        };
      });

    if (sources.length === 0) {
      return json({
        answer: "I could not find reliable live web sources for this query. Try making the question more specific or removing domain-specific terms.",
        sources: [],
      });
    }

    const systemPrompt = `You are Weybre AI's web research assistant for Indian lawyers. Use live web search to answer the question accurately.

RULES:
1. Always ground your answer in the live web search results. Never invent facts, statutes, or case names.
2. Use inline numbered citations like [1], [2] matching the sources you cite. Every factual claim MUST have a citation.
3. Prefer authoritative Indian sources: government portals (.gov.in, .nic.in), Supreme Court / High Court websites, Bar Council of India, Ministry of Law, reputable legal news (LiveLaw, Bar & Bench, SCC Online, LegallyIndia), and major Indian newspapers.
4. If the question is about Indian law, prioritize Indian sources and Indian context (Sections, Articles, lakh/crore).
5. Structure: a brief direct answer (2-3 sentences) → key supporting points with citations → caveats / what to verify.
6. Maximum 350 words. Be precise, not verbose.
7. End with a one-line "Verify before relying on this for filings" note.
8. Never give legal advice — frame as "according to [source]…" not "you should…".`;

    const sourceContext = sources.map((s) => `[${s.n}] ${s.title}\nURL: ${s.url}\nSource: ${s.domain}\nExcerpt: ${s.snippet ?? ""}`).join("\n\n---\n\n");
    const userPrompt = `QUESTION: ${query}\n\nREAL WEB SEARCH RESULTS FROM TAVILY:\n\n${sourceContext}\n\nAnswer using only these sources. Use [n] citations that match the numbered sources.`;

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
      return json({ error: "Web search failed" }, 500);
    }

    const j = await r.json();
    const choice = j.choices?.[0];
    const answer: string = choice?.message?.content ?? "No answer generated.";

    // Extract grounding citations. Lovable AI Gateway surfaces Gemini's
    // groundingMetadata / citation_metadata in a few possible shapes — handle them all.
    const sources: WebSource[] = [];
    const seen = new Set<string>();
    const pushSource = (url: string | undefined, title?: string, snippet?: string) => {
      if (!url || typeof url !== "string") return;
      try {
        const u = new URL(url);
        const key = u.href;
        if (seen.has(key)) return;
        seen.add(key);
        sources.push({
          n: sources.length + 1,
          title: title || u.hostname,
          url: key,
          domain: u.hostname.replace(/^www\./, ""),
          snippet,
        });
      } catch { /* ignore invalid */ }
    };

    const gm = choice?.message?.grounding_metadata
      ?? choice?.grounding_metadata
      ?? choice?.message?.groundingMetadata
      ?? choice?.groundingMetadata;

    const chunks = gm?.grounding_chunks ?? gm?.groundingChunks ?? [];
    for (const c of chunks) {
      const web = c?.web ?? c?.Web;
      if (web?.uri) pushSource(web.uri, web.title, web.snippet);
    }

    const cm = choice?.message?.citations ?? choice?.citations ?? gm?.citations ?? [];
    for (const c of cm) {
      const url = typeof c === "string" ? c : (c?.url ?? c?.uri);
      const title = typeof c === "object" ? (c?.title ?? c?.name) : undefined;
      const snippet = typeof c === "object" ? (c?.snippet ?? c?.text) : undefined;
      pushSource(url, title, snippet);
    }

    // Last-resort fallback: scrape any URLs from the answer text itself
    if (sources.length === 0) {
      const matches = answer.match(/https?:\/\/[^\s\)\]]+/g) ?? [];
      for (const m of matches) pushSource(m);
    }

    // Log usage (best-effort)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await admin.from("usage_events").insert({
      user_id: user.id,
      event_type: "web_search",
      tokens: j.usage?.total_tokens ?? 0,
      metadata: { query, sources: sources.length },
    });

    return json({ answer, sources });
  } catch (e) {
    console.error("web-search error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
