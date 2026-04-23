import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { AiDisclaimer } from "@/components/AiDisclaimer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Search, Sparkles, BookOpen, Save, FileDown, Loader2, ArrowUp, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Citation {
  id: string;
  title: string;
  citation?: string | null;
  neutral_citation?: string | null;
  decision_date?: string | null;
  bench?: string | null;
  judges?: string[] | null;
  headnote?: string | null;
  summary?: string | null;
  similarity?: number;
}

const SAMPLE_QUERIES = [
  "When can specific performance be denied due to delay in approaching the court?",
  "Recent SC judgments on anticipatory bail under Section 438 CrPC",
  "Doctrine of frustration in commercial contracts post-COVID",
  "Burden of proof in matrimonial cruelty cases under Section 13(1)(ia) HMA",
];

const Research = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [matters, setMatters] = useState<{id: string; name: string}[]>([]);
  const [selectedMatter, setSelectedMatter] = useState<string>("");
  const [newMatterName, setNewMatterName] = useState("");
  const [saving, setSaving] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("matters").select("id,name").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setMatters(data ?? []));
  }, [user]);

  const handleAsk = async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text) return;
    setQuery(text);
    setLoading(true);
    setAnswer("");
    setCitations([]);
    setReasoning("Searching Indian Supreme Court corpus…");

    try {
      const { data, error } = await supabase.functions.invoke("research", {
        body: { query: text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnswer(data.answer ?? "");
      setCitations(data.citations ?? []);
      setReasoning("");
    } catch (err: any) {
      const msg = err?.message ?? "Research failed";
      if (msg.includes("rate") || msg.includes("429")) {
        toast.error("AI is busy", { description: "Please retry in a moment." });
      } else if (msg.includes("402") || msg.toLowerCase().includes("payment")) {
        toast.error("AI credits exhausted", { description: "Add credits in Settings → Workspace → Usage." });
      } else {
        toast.error("Research failed", { description: msg });
      }
      setReasoning("");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!user || !answer) return;
    setSaving(true);
    let matterId = selectedMatter;
    if (!matterId && newMatterName.trim()) {
      const { data, error } = await supabase.from("matters").insert({
        user_id: user.id, name: newMatterName.trim(),
      }).select("id").single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      matterId = data.id;
    }
    const { error } = await supabase.from("research_notes").insert({
      user_id: user.id,
      matter_id: matterId || null,
      query,
      answer,
      citations: citations as any,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Saved to matter");
    setShowSave(false);
    setNewMatterName("");
    setSelectedMatter("");
    setSaving(false);
  };

  const renderAnswer = (txt: string) => {
    // Convert [n] citation tokens into clickable chips
    const parts = txt.split(/(\[\d+\])/g);
    return parts.map((p, i) => {
      const m = p.match(/^\[(\d+)\]$/);
      if (m) {
        const idx = parseInt(m[1], 10) - 1;
        const c = citations[idx];
        return (
          <button
            key={i}
            onClick={() => document.getElementById(`cite-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="citation-chip mx-0.5 align-baseline"
            title={c?.title}
          >
            [{m[1]}]
          </button>
        );
      }
      return <span key={i}>{p}</span>;
    });
  };

  return (
    <AppShell title="Research">
      <div className="container max-w-5xl py-8">
        {/* Ask box */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Ask in plain English or Hindi</span>
          </div>
          <Textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. Can a contract be specifically enforced when the plaintiff has delayed approaching the court?"
            className="min-h-[100px] resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAsk(); }}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">⌘ + Enter to ask</span>
            <Button onClick={() => handleAsk()} disabled={loading || !query.trim()} className="bg-primary hover:bg-primary-glow">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              Ask
            </Button>
          </div>
        </div>

        {/* Sample queries */}
        {!answer && !loading && (
          <div className="mt-6">
            <p className="mb-3 font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">Try a sample</p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_QUERIES.map(s => (
                <button key={s} onClick={() => handleAsk(s)} className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reasoning state */}
        {reasoning && (
          <div className="mt-8 flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span className="font-mono text-xs uppercase tracking-wider">{reasoning}</span>
          </div>
        )}

        {/* Answer */}
        {answer && (
          <div ref={answerRef} className="mt-8 animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <AiDisclaimer />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowSave(true)}>
                  <Save className="h-4 w-4" /> Save to matter
                </Button>
              </div>
            </div>

            <article className="rounded-xl border border-border bg-card p-7">
              <div className="prose prose-slate max-w-none font-serif text-[1.02rem] leading-[1.75] text-foreground">
                {answer.split("\n\n").map((para, i) => (
                  <p key={i} className="mb-4 last:mb-0">{renderAnswer(para)}</p>
                ))}
              </div>
            </article>

            {/* Citations */}
            {citations.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-4 flex items-center gap-2 font-serif text-lg font-semibold text-primary">
                  <BookOpen className="h-4 w-4 text-accent" /> Cited judgments
                </h3>
                <div className="space-y-3">
                  {citations.map((c, i) => (
                    <div key={c.id} id={`cite-${i}`} className="rounded-lg border border-border bg-card p-5">
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <h4 className="font-serif text-base font-semibold text-primary">[{i+1}] {c.title}</h4>
                        {c.similarity != null && (
                          <span className="font-mono text-[0.7rem] text-muted-foreground">{(c.similarity * 100).toFixed(0)}% match</span>
                        )}
                      </div>
                      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.7rem] text-muted-foreground">
                        {c.neutral_citation && <span>{c.neutral_citation}</span>}
                        {c.citation && <span>· {c.citation}</span>}
                        {c.decision_date && <span>· {new Date(c.decision_date).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}</span>}
                        {c.bench && <span>· {c.bench}</span>}
                      </div>
                      {c.headnote && <p className="text-sm leading-relaxed text-muted-foreground">{c.headnote}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save dialog */}
      <Dialog open={showSave} onOpenChange={setShowSave}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Save research note</DialogTitle>
            <DialogDescription>Attach this answer to an existing matter or create a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {matters.length > 0 && (
              <div className="space-y-1.5">
                <Label>Existing matter</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedMatter}
                  onChange={e => { setSelectedMatter(e.target.value); setNewMatterName(""); }}
                >
                  <option value="">— choose —</option>
                  {matters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Or create new matter</Label>
              <Input value={newMatterName} onChange={e => { setNewMatterName(e.target.value); setSelectedMatter(""); }} placeholder="e.g. Sharma v. Mehta — specific performance" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSave(false)}>Cancel</Button>
            <Button onClick={handleSaveNote} disabled={saving || (!selectedMatter && !newMatterName.trim())}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default Research;
