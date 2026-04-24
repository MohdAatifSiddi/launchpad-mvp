// Admin-only ingestion endpoint: accepts a batch of judgment rows and embeds them.
// Called from a local script during initial corpus load. Idempotent on external_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface InRow {
  external_id?: string;
  title: string;
  citation?: string;
  neutral_citation?: string;
  bench?: string;
  judges?: string[];
  decision_date?: string | null;
  disposition?: string;
  headnote?: string;
  summary?: string;
  full_text?: string;
}

async function embed(text: string): Promise<number[] | null> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/text-embedding-004", input: text.slice(0, 7500) }),
  });
  if (!r.ok) { console.error("embed", r.status, await r.text()); return null; }
  const j = await r.json();
  const v: number[] = j.data?.[0]?.embedding ?? [];
  if (v.length === 1536) return v;
  if (v.length > 1536) return v.slice(0, 1536);
  return [...v, ...new Array(1536 - v.length).fill(0)];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: must present the service role key as Bearer token.
    const auth = req.headers.get("Authorization") ?? "";
    const presented = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!presented || presented !== SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Forbidden" }, 403);
    }

    const { rows } = await req.json() as { rows: InRow[] };
    if (!Array.isArray(rows) || rows.length === 0) return json({ error: "rows[] required" }, 400);
    if (rows.length > 20) return json({ error: "Max 20 rows per batch" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const out: any[] = [];
    for (const row of rows) {
      const text = [row.title, row.headnote, row.summary, row.full_text].filter(Boolean).join("\n\n");
      const vec = await embed(text || row.title);
      const record: any = {
        external_id: row.external_id ?? null,
        title: row.title,
        citation: row.citation ?? null,
        neutral_citation: row.neutral_citation ?? null,
        court: "Supreme Court of India",
        bench: row.bench ?? null,
        judges: row.judges ?? null,
        decision_date: row.decision_date ?? null,
        disposition: row.disposition ?? null,
        headnote: row.headnote ?? null,
        summary: row.summary ?? null,
        full_text: row.full_text ?? null,
        embedding: vec ? `[${vec.join(",")}]` : null,
      };

      if (row.external_id) {
        const { error } = await admin.from("judgments").upsert(record, { onConflict: "external_id" });
        if (error) { out.push({ ok: false, error: error.message, external_id: row.external_id }); continue; }
      } else {
        const { error } = await admin.from("judgments").insert(record);
        if (error) { out.push({ ok: false, error: error.message }); continue; }
      }
      out.push({ ok: true, external_id: row.external_id, embedded: !!vec });
    }

    return json({ processed: out.length, results: out });
  } catch (e) {
    console.error("ingest", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
