import { useRef, useState } from "react";
import { Mic, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Props {
  onTranscript: (text: string) => void;
  language?: "en" | "hi" | "auto";
  size?: "sm" | "icon";
}

/** Mic button → records audio → sends to elevenlabs-stt edge function → returns text. */
export function VoiceInputButton({ onTranscript, language = "auto", size = "icon" }: Props) {
  const { t, i18n } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        await transcribe(blob);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("Microphone permission required");
    }
  }

  function stop() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  async function transcribe(blob: Blob) {
    setBusy(true);
    try {
      const arrayBuf = await blob.arrayBuffer();
      const b64 = btoa(
        new Uint8Array(arrayBuf).reduce((s, b) => s + String.fromCharCode(b), "")
      );
      const lang = language === "auto" ? i18n.language : language;
      const { data, error } = await supabase.functions.invoke("elevenlabs-stt", {
        body: { audio: b64, language: lang === "hi" ? "hin" : "eng", mime: "audio/webm" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const text = (data as any)?.text?.trim();
      if (text) onTranscript(text);
      else toast.error("No speech detected");
    } catch (e: any) {
      toast.error(e?.message ?? "Transcription failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant={recording ? "destructive" : "ghost"}
      size={size}
      onClick={recording ? stop : start}
      disabled={busy}
      title={recording ? t("common.stop") : t("common.speak")}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> :
        recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}
