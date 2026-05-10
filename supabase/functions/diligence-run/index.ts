// Diligence extraction worker. Processes a batch of pending cells for a room.
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

const PRIMARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "openai/gpt-5-mini";
const MAX_CONCURRENT = 6;
const MAX_BATCH = 24;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Pick the most relevant ~3k char window from the document text.
function pickRelevantSection(text: string, prompt: string): string {
  if (text.length <= 6000) return text;
  const keywords = prompt.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const windowSize = 3500;
  const stride = 1500;
  let best = text.slice(0, windowSize);
  let bestScore = -1;
  for (let i = 0; i < text.length; i += stride) {
    const chunk = text.slice(i, i + windowSize).toLowerCase();
    let score = 0;
    for (const kw of keywords) if (chunk.includes(kw)) score += 1;
    if (score > bestScore) { bestScore = score; best = text.slice(i, i + windowSize); }
  }
  return best;
}

async function extractCell(model: string, docText: string, fileName: string, prompt: string, expected: string): Promise<{
  answer: string; verbatim_quote: string; page_ref: string; confidence: number;
}> {
  const section = pickRelevantSection(docText, prompt);
  const sys = `You extract precise answers from legal/commercial documents for an Indian lawyer. Return STRICT JSON only with keys: answer, verbatim_quote, page_ref, confidence. Rules: 1) answer is a concise plain-prose response (1-3 sentences, NO markdown, NO headings, NO bullets). 2) verbatim_quote MUST be copied word-for-word from the source text — if nothing is on point, use empty string. 3) page_ref like "p. 4" if a [Page N] marker is visible near the quote, else "". 4) confidence is 0.0-1.0. 5) If the document does not address the question, set answer to "Not found in document" and confidence to 0.`;

  const user = `DOCUMENT: ${fileName}\nEXPECTED FORMAT: ${expected}\n\nSOURCE TEXT (relevant section):\n${section}\n\nQUESTION: ${prompt}`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AI ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  const content = j.choices?.[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(content); } catch { parsed = {}; }
  return {
    answer: String(parsed.answer ?? "").trim() || "Not found in document",
    verbatim_quote: String(parsed.verbatim_quote ?? "").trim(),
    page_ref: String(parsed.page_ref ?? "").trim(),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const roomId: string | undefined = body.room_id;
    if (!roomId) return json({ error: "room_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch pending cells (limit batch)
    const { data: cells, error: cellsErr } = await admin
      .from("diligence_cells")
      .select("id, document_id, question_id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .limit(MAX_BATCH);
    if (cellsErr) throw cellsErr;
    if (!cells?.length) return json({ processed: 0, remaining: 0 });

    const docIds = [...new Set(cells.map(c => c.document_id))];
    const qIds = [...new Set(cells.map(c => c.question_id))];

    const [{ data: docs }, { data: qs }] = await Promise.all([
      admin.from("diligence_documents").select("id, file_name, extracted_text").in("id", docIds),
      admin.from("diligence_questions").select("id, prompt, expected_format").in("id", qIds),
    ]);
    const docMap = new Map(docs?.map((d: any) => [d.id, d]) ?? []);
    const qMap = new Map(qs?.map((q: any) => [q.id, q]) ?? []);

    // Mark as running
    await admin.from("diligence_cells").update({ status: "running" }).in("id", cells.map(c => c.id));

    let processed = 0;
    // Worker pool
    const queue = [...cells];
    const workers = Array.from({ length: MAX_CONCURRENT }, async () => {
      while (queue.length) {
        const cell = queue.shift();
        if (!cell) break;
        const doc: any = docMap.get(cell.document_id);
        const q: any = qMap.get(cell.question_id);
        if (!doc || !q) {
          await admin.from("diligence_cells").update({ status: "error", error_message: "Missing doc/question" }).eq("id", cell.id);
          continue;
        }
        try {
          let result;
          let usedModel = PRIMARY_MODEL;
          try {
            result = await extractCell(PRIMARY_MODEL, doc.extracted_text || "", doc.file_name, q.prompt, q.expected_format || "text");
          } catch (e) {
            usedModel = FALLBACK_MODEL;
            result = await extractCell(FALLBACK_MODEL, doc.extracted_text || "", doc.file_name, q.prompt, q.expected_format || "text");
          }
          await admin.from("diligence_cells").update({
            status: "done",
            answer: result.answer,
            verbatim_quote: result.verbatim_quote,
            page_ref: result.page_ref,
            confidence: result.confidence,
            model: usedModel,
            error_message: null,
          }).eq("id", cell.id);
          processed += 1;
        } catch (e: any) {
          await admin.from("diligence_cells").update({
            status: "error",
            error_message: String(e?.message ?? e).slice(0, 500),
          }).eq("id", cell.id);
        }
      }
    });
    await Promise.all(workers);

    const { count: remaining } = await admin
      .from("diligence_cells")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("status", "pending");

    return json({ processed, remaining: remaining ?? 0 });
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
