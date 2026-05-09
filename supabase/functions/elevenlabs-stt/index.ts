const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured");
    const { audio, language, mime } = await req.json();
    if (!audio) throw new Error("audio required");

    const bin = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
    const blob = new Blob([bin], { type: mime ?? "audio/webm" });

    const fd = new FormData();
    fd.append("file", blob, "audio.webm");
    fd.append("model_id", "scribe_v1");
    fd.append("tag_audio_events", "false");
    if (language && language !== "auto") fd.append("language_code", language);

    const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: fd,
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`STT ${resp.status}: ${err.slice(0, 300)}`);
    }
    const data = await resp.json();
    return new Response(JSON.stringify({ text: data.text ?? "", language: data.language_code }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("STT error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
