import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VOICE_HI = "pFZP5JQG7iQjIQuC4Bku"; // Lily — multilingual
const VOICE_EN = "JBFqnCBsd6RMkjVDRZzb"; // George

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured");
    const { text, language, voiceId } = await req.json();
    if (!text || typeof text !== "string") throw new Error("text required");

    const voice = voiceId || (language === "hi" ? VOICE_HI : VOICE_EN);

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.slice(0, 4800),
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`TTS ${resp.status}: ${err.slice(0, 300)}`);
    }
    const buf = await resp.arrayBuffer();
    const audio = encodeBase64(new Uint8Array(buf));
    return new Response(JSON.stringify({ audio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("TTS error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
