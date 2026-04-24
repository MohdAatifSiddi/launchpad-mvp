// Export a matter (research notes + draft list) to PDF.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
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

    const { matter_id } = await req.json();
    if (!matter_id) return json({ error: "matter_id required" }, 400);

    const [{ data: matter }, { data: notes }, { data: drafts }] = await Promise.all([
      userClient.from("matters").select("name, client, area, description, created_at").eq("id", matter_id).maybeSingle(),
      userClient.from("research_notes").select("query, answer, citations, created_at").eq("matter_id", matter_id).order("created_at", { ascending: true }),
      userClient.from("drafts").select("title, template, status, updated_at").eq("matter_id", matter_id).order("updated_at", { ascending: false }),
    ]);

    if (!matter) return json({ error: "Matter not found" }, 404);

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 56;
    const maxW = pageW - margin * 2;
    let y = margin;

    const writeLine = (text: string, opts: { font?: "bold" | "normal"; size?: number; gap?: number } = {}) => {
      doc.setFont("times", opts.font ?? "normal");
      doc.setFontSize(opts.size ?? 11);
      const lines = doc.splitTextToSize(text, maxW);
      for (const line of lines) {
        if (y > pageH - margin - 20) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += (opts.size ?? 11) + 4;
      }
      y += opts.gap ?? 6;
    };

    writeLine(matter.name, { font: "bold", size: 20, gap: 8 });
    if (matter.client) writeLine(`Client: ${matter.client}`);
    if (matter.area) writeLine(`Area of practice: ${matter.area}`);
    if (matter.description) writeLine(matter.description);
    y += 12;

    writeLine("RESEARCH NOTES", { font: "bold", size: 14, gap: 8 });
    if (!notes || notes.length === 0) writeLine("(no research notes saved)", { gap: 12 });
    else {
      notes.forEach((n: any, i: number) => {
        writeLine(`${i + 1}. ${n.query}`, { font: "bold", gap: 4 });
        writeLine(n.answer, { gap: 4 });
        const cites = (n.citations ?? []) as any[];
        if (cites.length) {
          writeLine("Cited cases: " + cites.map(c => `[${c.n}] ${c.citation || c.title}`).join("; "), { size: 9, gap: 12 });
        } else y += 8;
      });
    }

    writeLine("DRAFTS IN THIS MATTER", { font: "bold", size: 14, gap: 8 });
    if (!drafts || drafts.length === 0) writeLine("(no drafts)");
    else drafts.forEach((d: any) => writeLine(`• ${d.title} — ${d.template} (${d.status})`));

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(120);
      doc.text(`NyayAI · Matter export · Page ${i} of ${pages}`, pageW / 2, pageH - 24, { align: "center" });
      doc.setTextColor(0);
    }

    const bytes = new Uint8Array(doc.output("arraybuffer"));
    return json({ file: bytesToBase64(bytes), filename: `${matter.name}.pdf` });
  } catch (e) {
    console.error("export-matter error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
