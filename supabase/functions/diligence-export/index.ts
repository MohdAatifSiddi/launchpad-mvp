// Export a diligence room as CSV.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

function csvEscape(v: any): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });

    const url = new URL(req.url);
    const roomId = url.searchParams.get("room_id") || (await req.json().catch(() => ({}))).room_id;
    if (!roomId) return new Response("room_id required", { status: 400, headers: corsHeaders });

    const [{ data: docs }, { data: qs }, { data: cells }] = await Promise.all([
      client.from("diligence_documents").select("id, file_name, position, created_at").eq("room_id", roomId).order("created_at"),
      client.from("diligence_questions").select("id, label, position").eq("room_id", roomId).order("position"),
      client.from("diligence_cells").select("document_id, question_id, answer, verbatim_quote, page_ref, confidence, status").eq("room_id", roomId),
    ]);

    const cellMap = new Map<string, any>();
    cells?.forEach((c: any) => cellMap.set(`${c.document_id}|${c.question_id}`, c));

    const header = ["Document", ...((qs ?? []).map((q: any) => q.label))].map(csvEscape).join(",");
    const lines = [header];
    for (const d of (docs ?? [])) {
      const row = [d.file_name];
      for (const q of (qs ?? [])) {
        const c = cellMap.get(`${d.id}|${q.id}`);
        row.push(c?.answer || "");
      }
      lines.push(row.map(csvEscape).join(","));
    }
    const csv = lines.join("\n");
    return new Response(csv, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/csv; charset=utf-8" },
    });
  } catch (e: any) {
    return new Response(String(e?.message ?? e), { status: 500, headers: corsHeaders });
  }
});
