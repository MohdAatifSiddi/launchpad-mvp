// Multilingual OCR via Gemini vision (Hindi, Tamil, Devanagari, Latin, etc.)
// Accepts up to 12 page images (base64 data URLs or raw base64) and returns extracted text.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const MAX_IMAGES = 12;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeImage(s: string): { mime: string; data: string } | null {
  if (!s) return null;
  const m = s.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/);
  if (m) return { mime: m[1], data: m[2] };
  // assume raw base64 PNG
  return { mime: "image/png", data: s };
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
    const images: string[] = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
    const languageHint: string = String(body.languageHint ?? "auto");
    if (images.length === 0) return json({ error: "Provide at least one image (base64 or data URL)." }, 400);

    const parts: any[] = [
      {
        type: "text",
        text:
          `You are a multilingual OCR engine for Indian legal documents. ` +
          `Extract ALL text from the page images verbatim, preserving order, paragraphs, and headings. ` +
          `Handle Hindi (Devanagari), Tamil, Bengali, Marathi, Gujarati, Kannada, Telugu, Malayalam, Punjabi, Urdu and English. ` +
          `Do not summarize, translate, or comment. Return only the extracted text. ` +
          `Language hint: ${languageHint}.`,
      },
    ];
    for (const img of images) {
      const norm = normalizeImage(img);
      if (!norm) continue;
      parts.push({
        type: "image_url",
        image_url: { url: `data:${norm.mime};base64,${norm.data}` },
      });
    }

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: parts }],
      }),
    });

    if (r.status === 429) return json({ error: "Rate limit reached. Please retry shortly." }, 429);
    if (r.status === 402) return json({ error: "AI credits exhausted." }, 402);
    if (!r.ok) {
      const t = await r.text();
      console.error("vision-ocr ai error", r.status, t);
      return json({ error: "Vision OCR failed" }, 500);
    }
    const j = await r.json();
    const text: string = j.choices?.[0]?.message?.content ?? "";

    return json({ text, pages: images.length, tokens: j.usage?.total_tokens ?? 0 });
  } catch (e) {
    console.error("vision-ocr error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
