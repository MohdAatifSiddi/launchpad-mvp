import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { encode as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

// Multilingual voices that handle Hindi + English well.
const VOICE_HI = "pFZP5JQG7iQjIQuC4Bku"; // Lily — multilingual
const VOICE_EN = "JBFqnCBsd6RMkjVDRZzb"; // George — clear professional

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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
          voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.0 },
        }),
      }
    );
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`TTS ${resp.status}: ${err.slice(0, 200)}`);
    }
    const buf = await resp.arrayBuffer();
    const audio = base64Encode(new Uint8Array(buf));
    return new Response(JSON.stringify({ audio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
