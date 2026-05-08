import { useRef, useState } from "react";
import { Volume2, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { detectScript } from "@/lib/langDetect";

interface Props { text: string; }

/** Reads AI answer aloud using ElevenLabs TTS edge function. */
export function ReadAloudButton({ text }: Props) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
  }

  async function play() {
    if (!text?.trim()) return;
    setBusy(true);
    try {
      const cleaned = text.replace(/\[\d+\]/g, "").replace(/[#*_`>]/g, "").slice(0, 4500);
      const lang = detectScript(cleaned) === "hi" || i18n.language === "hi" ? "hi" : "en";
      const { data, error } = await supabase.functions.invoke("elevenlabs-tts", {
        body: { text: cleaned, language: lang },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const audioUrl = `data:audio/mpeg;base64,${(data as any).audio}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      setPlaying(true);
      await audio.play();
    } catch (e: any) {
      toast.error(e?.message ?? "Playback failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={playing ? stop : play} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> :
        playing ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      {playing ? t("common.stop") : t("common.listen")}
    </Button>
  );
}
