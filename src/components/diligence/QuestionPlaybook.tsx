import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLAYBOOKS } from "@/lib/diligenceTemplates";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DQuestion { id: string; label: string; prompt: string; expected_format: string; position: number; }

export const QuestionPlaybook = ({ roomId, userId, questions, onChange }: {
  roomId: string; userId: string; questions: DQuestion[]; onChange: (qs: DQuestion[]) => void;
}) => {
  const [label, setLabel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  const addQuestion = async (lbl: string, prm: string) => {
    if (!lbl.trim() || !prm.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await (supabase as any).from("diligence_questions").insert({
        room_id: roomId, user_id: userId, label: lbl.trim(), prompt: prm.trim(),
        expected_format: "text", position: questions.length,
      }).select("id,label,prompt,expected_format,position").single();
      if (error) throw error;
      onChange([...questions, data as DQuestion]);
      setLabel(""); setPrompt("");
    } catch (e: any) {
      toast.error("Could not add", { description: e?.message });
    } finally { setAdding(false); }
  };

  const removeQuestion = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("diligence_questions").delete().eq("id", id);
      if (error) throw error;
      onChange(questions.filter(q => q.id !== id));
    } catch (e: any) {
      toast.error("Could not delete", { description: e?.message });
    }
  };

  const loadTemplate = async (key: string) => {
    const tpl = PLAYBOOKS.find(p => p.key === key);
    if (!tpl) return;
    setLoading(true);
    try {
      const rows = tpl.questions.map((q, i) => ({
        room_id: roomId, user_id: userId, label: q.label, prompt: q.prompt,
        expected_format: q.expected_format ?? "text", position: questions.length + i,
      }));
      const { data, error } = await (supabase as any).from("diligence_questions").insert(rows).select("id,label,prompt,expected_format,position");
      if (error) throw error;
      onChange([...questions, ...((data ?? []) as DQuestion[])]);
      toast.success(`Loaded ${tpl.name}`);
    } catch (e: any) {
      toast.error("Could not load template", { description: e?.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-base font-semibold text-primary">Playbook ({questions.length})</h3>
        <Select onValueChange={loadTemplate} disabled={loading}>
          <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Load template…" /></SelectTrigger>
          <SelectContent>
            {PLAYBOOKS.map(p => <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 space-y-2">
        {questions.map(q => (
          <div key={q.id} className="flex items-start gap-2 border border-border bg-background px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{q.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{q.prompt}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => removeQuestion(q.id)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2 border-t border-border pt-3">
        <Input placeholder="Question label (e.g. Governing law)" value={label} onChange={e => setLabel(e.target.value)} />
        <Textarea placeholder="Prompt to the AI (e.g. What is the governing law? Quote.)" value={prompt} onChange={e => setPrompt(e.target.value)} className="min-h-[60px]" />
        <Button size="sm" variant="outline" onClick={() => addQuestion(label, prompt)} disabled={adding || !label.trim() || !prompt.trim()}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add question
        </Button>
      </div>
    </div>
  );
};
