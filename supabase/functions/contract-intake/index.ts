// Contract Intake & Classification Agent v2
// Structure-first extraction: preserves clause logic (actor, trigger, condition,
// consequence), conditionality anchors ("as a result of such default"), missing
// placeholders, and separates Layer 1 (facts) from Layer 2 (risk inference)
// from Layer 3 (jurisdiction commentary). Verbatim quotes are required for
// every structured clause so the lawyer can verify before relying on output.
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
  "Consulting Agreement", "Service Agreement", "Lease", "Loan Agreement",
  "Shareholders Agreement", "Notice", "Reply to Notice", "Vakalatnama",
  "Power of Attorney", "Other",
] as const;

const CLAUSE_TYPES = [
  "termination", "indemnification", "limitation_of_liability", "ip_assignment",
  "confidentiality", "non_compete", "non_solicit", "payment_terms",
  "warranties", "insurance", "audit_rights", "governing_law", "dispute_resolution",
  "force_majeure", "assignment", "renewal", "change_of_control", "data_protection",
  "publicity", "notices", "amendments", "severability", "entire_agreement", "other",
] as const;

const SYSTEM = `You are an enterprise-grade legal extraction engine for Indian contracts.

ABSOLUTE RULES
1. STRUCTURE FIRST, prose second. Never collapse a conditional clause into a flat statement.
2. Preserve every dependency anchor: IF / UNLESS / EXCEPT / SUBJECT TO / PROVIDED THAT / "as a result of such default" / "to the extent caused by" — they MUST appear in the clause's trigger or condition fields, never silently dropped.
3. For every structured clause you output, include a verbatim_quote (exact substring from the document, ≤ 600 chars) and a page_ref. If you cannot ground a clause in a verbatim quote, DO NOT emit it.
4. Separate three layers and never mix them:
   - Layer 1 facts: only what the contract literally says (clauses[], parties, dates, missing_fields).
   - Layer 2 risk: inferences ABOUT the facts (risk_assessments[]). Each item must cite the clause_id it interprets.
   - Layer 3 commentary: jurisdictional or business advice (jurisdiction_notes[]). Optional, clearly flagged as commentary.
5. Detect blank placeholders. If the contract reads "shall take effect on (DATE)" or "_____" or "[●]", record the field in missing_fields with the exact placeholder text and its semantic role (effective_date, party_name, fee_amount, etc.). Do NOT silently set the date to null as if it were merely absent.
6. Capture asymmetry. For each material clause, set favors = "PARTY_A" | "PARTY_B" | "balanced" | "unclear" based on who bears the burden / who benefits. Aggregate into asymmetry_summary.
7. Never invent parties, dates, numbers, citations, or section references.
8. Confidence is per-clause and per-field. Be conservative — under 0.78 if you are uncertain.

OUTPUT — strict JSON, no prose, matching this schema exactly:
{
  "doc_type": one of ${JSON.stringify(DOC_TYPES)},
  "doc_type_confidence": number 0-1,
  "parties": [
    { "name": string, "role": string | null, "type": "individual"|"company"|"government"|"unknown", "verbatim_quote": string, "page_ref": string }
  ],
  "effective_date": "YYYY-MM-DD" | null,
  "expiry_date": "YYYY-MM-DD" | null,
  "jurisdiction": string | null,
  "governing_law": string | null,
  "missing_fields": [
    { "field": string, "placeholder_text": string, "page_ref": string, "operational_impact": string }
  ],
  "clauses": [
    {
      "clause_id": string,
      "clause_type": one of ${JSON.stringify(CLAUSE_TYPES)},
      "actor": string,
      "trigger": string[],
      "condition": string | null,
      "consequence": string,
      "notice_period_days": number | null,
      "cure_period_days": number | null,
      "favors": "PARTY_A" | "PARTY_B" | "balanced" | "unclear",
      "verbatim_quote": string,
      "page_ref": string,
      "confidence": number 0-1
    }
  ],
  "asymmetry_summary": {
    "tilt": "PARTY_A" | "PARTY_B" | "balanced",
    "rationale": string,
    "supporting_clause_ids": string[]
  },
  "risk_assessments": [
    {
      "clause_id": string,
      "severity": "LOW" | "MEDIUM" | "HIGH",
      "issue": string,
      "why_it_matters": string,
      "confidence": number 0-1
    }
  ],
  "jurisdiction_notes": [
    { "topic": string, "note": string, "is_commentary": true }
  ],
  "overall_risk_level": "LOW" | "MEDIUM" | "HIGH",
  "extracted_text": string (verbatim text of the document, preserve order)
}

Return ONLY the JSON object. No markdown fences.`;

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

    const { data: contract, error: cErr } = await admin
      .from("contracts").select("*").eq("id", contractId).single();
    if (cErr || !contract) return json({ error: "Contract not found" }, 404);
    if (contract.user_id !== user.id) return json({ error: "Forbidden" }, 403);

    await admin.from("contracts").update({ status: "processing", error_message: null }).eq("id", contractId);

    const { data: fileBlob, error: dlErr } = await admin.storage
      .from("contract-intake")
      .download(contract.storage_path);
    if (dlErr || !fileBlob) {
      await admin.from("contracts").update({ status: "failed", error_message: dlErr?.message ?? "download failed" }).eq("id", contractId);
      return json({ error: dlErr?.message ?? "Download failed" }, 500);
    }

    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    const mime = contract.mime_type || fileBlob.type || "application/octet-stream";
    const dataUrl = await fileToDataUrl(bytes, mime);

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: `Filename: ${contract.file_name}\nMime: ${mime}\n\nExtract the contract using the structure-first schema. Preserve every conditional anchor verbatim. Flag every blank placeholder in missing_fields. Return JSON only.` },
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
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    const text: string = String(parsed.extracted_text ?? "").slice(0, 200_000);
    const confidence = Number(parsed.doc_type_confidence ?? 0);
    const docType: string | null = parsed.doc_type ?? null;
    const clauses = Array.isArray(parsed.clauses) ? parsed.clauses : [];
    const missingFields = Array.isArray(parsed.missing_fields) ? parsed.missing_fields : [];

    // Require verbatim grounding on every clause; drop ungrounded ones.
    const groundedClauses = clauses.filter((c: any) =>
      typeof c?.verbatim_quote === "string" && c.verbatim_quote.trim().length >= 10
    );

    const needsReview =
      !docType ||
      confidence < CONFIDENCE_THRESHOLD ||
      text.length < 200 ||
      groundedClauses.length === 0 ||
      missingFields.length > 0;

    const partiesNames = Array.isArray(parsed.parties)
      ? parsed.parties.map((p: any) => (typeof p === "string" ? p : p?.name)).filter(Boolean)
      : [];

    const riskReasons = Array.isArray(parsed.risk_assessments)
      ? parsed.risk_assessments
          .filter((r: any) => r?.issue)
          .map((r: any) => `[${r.severity ?? "MED"}] ${r.issue}${r.clause_id ? ` (clause ${r.clause_id})` : ""}`)
      : [];

    const analysis = {
      schema_version: 2,
      parties_detailed: Array.isArray(parsed.parties) ? parsed.parties : [],
      clauses: groundedClauses,
      missing_fields: missingFields,
      asymmetry_summary: parsed.asymmetry_summary ?? null,
      risk_assessments: Array.isArray(parsed.risk_assessments) ? parsed.risk_assessments : [],
      jurisdiction_notes: Array.isArray(parsed.jurisdiction_notes) ? parsed.jurisdiction_notes : [],
    };

    const update = {
      status: needsReview ? "needs_review" : "ready",
      doc_type: docType,
      doc_type_confidence: confidence,
      jurisdiction: parsed.jurisdiction ?? null,
      governing_law: parsed.governing_law ?? null,
      risk_level: parsed.overall_risk_level ?? parsed.risk_level ?? "MEDIUM",
      risk_reasons: riskReasons,
      parties: partiesNames,
      effective_date: parsed.effective_date || null,
      expiry_date: parsed.expiry_date || null,
      renewal_window: parsed.renewal_window ?? null,
      termination_clause: parsed.termination_clause ?? null,
      extracted_text: text,
      char_count: text.length,
      parse_method: "gemini-multimodal-structured-v2",
      model: "google/gemini-2.5-pro",
      needs_human_review: needsReview,
      analysis,
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
