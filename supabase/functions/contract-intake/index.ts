// Contract Intake & Classification Agent
// Receives a contract uploaded to the `contract-intake` bucket, asks Gemini to
// parse + classify + extract metadata in one multimodal pass, persists results
// to public.contracts, and flips status to ready / needs_review / failed.
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

const CONFIDENCE_THRESHOLD = 0.78;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const DOC_TYPES = [
  "NDA", "SaaS Agreement", "Vendor Agreement", "Employment Contract",
  "Service Agreement", "Lease", "Loan Agreement", "Shareholders Agreement",
  "Notice", "Reply to Notice", "Vakalatnama", "Power of Attorney", "Other",
] as const;

const SYSTEM = `You are an expert intake agent for Indian legal contracts. Read the document image(s) and return ONLY valid JSON, no prose, matching this schema:
{
  "doc_type": one of ${JSON.stringify(DOC_TYPES)},
  "doc_type_confidence": number 0-1,
  "parties": string[] (legal names of all parties),
  "effective_date": "YYYY-MM-DD" | null,
  "expiry_date": "YYYY-MM-DD" | null,
  "jurisdiction": string | null (e.g. "Mumbai, Maharashtra, India"),
  "governing_law": string | null (e.g. "Laws of India"),
  "renewal_window": string | null (plain English),
  "termination_clause": string | null (short summary),
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "risk_reasons": string[] (short bullet phrases),
  "extracted_text": string (verbatim text of the document, preserve order)
}
If a field is unknown, use null (or [] for arrays). Be conservative on confidence — under 0.78 if uncertain. Never invent parties or dates.`;

async function fileToDataUrl(bytes: Uint8Array, mime: string): Promise<string> {
  let b = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    b += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(b)}`;
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
    const contractId: string | undefined = body?.contractId;
    if (!contractId) return json({ error: "contractId required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load contract row (owner check via user_id)
    const { data: contract, error: cErr } = await admin
      .from("contracts").select("*").eq("id", contractId).single();
    if (cErr || !contract) return json({ error: "Contract not found" }, 404);
    if (contract.user_id !== user.id) return json({ error: "Forbidden" }, 403);

    await admin.from("contracts").update({ status: "processing", error_message: null }).eq("id", contractId);

    // Download file from storage
    const { data: fileBlob, error: dlErr } = await admin.storage
      .from("contract-intake")
      .download(contract.storage_path);
    if (dlErr || !fileBlob) {
      await admin.from("contracts").update({ status: "failed", error_message: dlErr?.message ?? "download failed" }).eq("id", contractId);
      return json({ error: dlErr?.message ?? "Download failed" }, 500);
    }

    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    const mime = contract.mime_type || fileBlob.type || "application/octet-stream";

    // Gemini can directly accept PDFs and images in multimodal input via the
    // OpenAI-compatible image_url field with data URL.
    const dataUrl = await fileToDataUrl(bytes, mime);

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: `Filename: ${contract.file_name}\nMime: ${mime}\nClassify and extract metadata. Return JSON only.` },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (r.status === 429) {
      await admin.from("contracts").update({ status: "failed", error_message: "Rate limit. Retry shortly." }).eq("id", contractId);
      return json({ error: "Rate limit" }, 429);
    }
    if (r.status === 402) {
      await admin.from("contracts").update({ status: "failed", error_message: "AI credits exhausted." }).eq("id", contractId);
      return json({ error: "Credits exhausted" }, 402);
    }
    if (!r.ok) {
      const t = await r.text();
      console.error("contract-intake ai error", r.status, t);
      await admin.from("contracts").update({ status: "failed", error_message: `AI ${r.status}` }).eq("id", contractId);
      return json({ error: "AI failed" }, 500);
    }

    const j = await r.json();
    const raw: string = j.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch {
      // sometimes model wraps in ```json
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    const text: string = String(parsed.extracted_text ?? "").slice(0, 120_000);
    const confidence = Number(parsed.doc_type_confidence ?? 0);
    const docType: string | null = parsed.doc_type ?? null;
    const needsReview = !docType || confidence < CONFIDENCE_THRESHOLD || text.length < 200;

    const update = {
      status: needsReview ? "needs_review" : "ready",
      doc_type: docType,
      doc_type_confidence: confidence,
      jurisdiction: parsed.jurisdiction ?? null,
      governing_law: parsed.governing_law ?? null,
      risk_level: parsed.risk_level ?? "MEDIUM",
      risk_reasons: Array.isArray(parsed.risk_reasons) ? parsed.risk_reasons : [],
      parties: Array.isArray(parsed.parties) ? parsed.parties : [],
      effective_date: parsed.effective_date || null,
      expiry_date: parsed.expiry_date || null,
      renewal_window: parsed.renewal_window ?? null,
      termination_clause: parsed.termination_clause ?? null,
      extracted_text: text,
      char_count: text.length,
      parse_method: "gemini-multimodal",
      model: "google/gemini-2.5-flash",
      needs_human_review: needsReview,
      error_message: null,
    };

    const { error: upErr } = await admin.from("contracts").update(update).eq("id", contractId);
    if (upErr) {
      console.error("contract-intake update error", upErr);
      return json({ error: upErr.message }, 500);
    }

    return json({ ok: true, contractId, ...update });
  } catch (e) {
    console.error("contract-intake error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
