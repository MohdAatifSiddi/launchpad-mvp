import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { AiDisclaimer } from "@/components/AiDisclaimer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Sparkles, BookOpen, Save, Loader2, ArrowUp, Globe, Scale, ExternalLink, Search } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type SearchMode = "case-law" | "web";

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

interface WebSource {
  n: number;
  title: string;
  url: string;
  domain: string;
  snippet?: string;
}

const CASE_LAW_SAMPLES = [
  "When can specific performance be denied due to delay in approaching the court?",
  "Recent SC judgments on anticipatory bail under Section 438 CrPC",
  "Doctrine of frustration in commercial contracts post-COVID",
  "Burden of proof in matrimonial cruelty cases under Section 13(1)(ia) HMA",
];

const WEB_SAMPLES = [
  "Latest amendments to the Bharatiya Nyaya Sanhita 2023",
  "Current Supreme Court Collegium recommendations",
  "DPDP Act 2023 — implementation rules notified so far",
  "GST rate changes for legal services in 2025",
];

const PROGRESS_STEPS_CASE = [
  "Searching Indian Supreme Court corpus…",
  "Ranking by hybrid semantic + keyword score…",
  "Synthesising answer with inline citations…",
];

const PROGRESS_STEPS_WEB = [
  "Querying live web sources…",
  "Filtering for authoritative Indian legal sources…",
  "Extracting citations and synthesising answer…",
];

const Research = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<SearchMode>("case-law");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [webSources, setWebSources] = useState<WebSource[]>([]);
  const [resultMode, setResultMode] = useState<SearchMode>("case-law");
  const [showSave, setShowSave] = useState(false);
  const [matters, setMatters] = useState<{ id: string; name: string }[]>([]);
  const [selectedMatter, setSelectedMatter] = useState<string>("");
  const [newMatterName, setNewMatterName] = useState("");
  const [saving, setSaving] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("matters").select("id,name").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setMatters(data ?? []));
  }, [user]);

  // Animated progress steps while loading
  useEffect(() => {
    if (!loading) return;
    setProgressStep(0);
    const steps = mode === "web" ? PROGRESS_STEPS_WEB : PROGRESS_STEPS_CASE;
    const interval = setInterval(() => {
      setProgressStep(s => Math.min(s + 1, steps.length - 1));
    }, 1800);
    return () => clearInterval(interval);
  }, [loading, mode]);

  const handleAsk = async (q?: string, overrideMode?: SearchMode) => {
    const text = (q ?? query).trim();
    if (!text) return;
    const activeMode = overrideMode ?? mode;
    setQuery(text);
    setLoading(true);
    setAnswer("");
    setCitations([]);
    setWebSources([]);
    setResultMode(activeMode);

    try {
      if (activeMode === "case-law") {
        const { data, error } = await supabase.functions.invoke("research", { body: { query: text } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setAnswer(data.answer ?? "");
        setCitations(data.citations ?? []);
      } else {
        const { data, error } = await supabase.functions.invoke("web-search", { body: { query: text } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setAnswer(data.answer ?? "");
        setWebSources(data.sources ?? []);
      }
    } catch (err: any) {
      const msg = err?.message ?? "Research failed";
      if (msg.includes("rate") || msg.includes("429")) {
        toast.error("AI is busy", { description: "Please retry in a moment." });
      } else if (msg.includes("402") || msg.toLowerCase().includes("payment") || msg.toLowerCase().includes("credits")) {
        toast.error("AI credits exhausted", { description: "Add credits in Settings → Workspace → Usage." });
      } else {
        toast.error("Research failed", { description: msg });
      }
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
    const citationsPayload = resultMode === "case-law" ? citations : webSources;
    const { error } = await supabase.from("research_notes").insert({
      user_id: user.id,
      matter_id: matterId || null,
      query,
      answer,
      citations: citationsPayload as any,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Saved to matter");
    setShowSave(false);
    setNewMatterName("");
    setSelectedMatter("");
    setSaving(false);
  };

  const renderAnswer = (txt: string) => {
    const parts = txt.split(/(\[\d+\])/g);
    return parts.map((p, i) => {
      const m = p.match(/^\[(\d+)\]$/);
      if (m) {
        const idx = parseInt(m[1], 10) - 1;
        const target =
          resultMode === "case-law" ? citations[idx] : webSources[idx];
        return (
          <button
            key={i}
            onClick={() => document.getElementById(`cite-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="citation-chip mx-0.5 align-baseline"
            title={(target as any)?.title ?? `Source ${m[1]}`}
          >
            [{m[1]}]
          </button>
        );
      }
      return <span key={i}>{p}</span>;
    });
  };

  const samples = mode === "web" ? WEB_SAMPLES : CASE_LAW_SAMPLES;
  const placeholder = mode === "web"
    ? "e.g. Latest Supreme Court ruling on electoral bonds, or status of the Mediation Act 2023…"
    : "e.g. Can a contract be specifically enforced when the plaintiff has delayed approaching the court?";
  const progressSteps = resultMode === "web" ? PROGRESS_STEPS_WEB : PROGRESS_STEPS_CASE;

  return (
    <AppShell title="Research">
      <div className="container max-w-5xl py-8">
        {/* Mode selector */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as SearchMode)} className="mb-5">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="case-law" className="gap-2">
              <Scale className="h-3.5 w-3.5" /> Case law
            </TabsTrigger>
            <TabsTrigger value="web" className="gap-2">
              <Globe className="h-3.5 w-3.5" /> Web search
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Ask box */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            {mode === "web" ? (
              <Globe className="h-4 w-4 text-accent" />
            ) : (
              <Sparkles className="h-4 w-4 text-accent" />
            )}
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {mode === "web"
                ? "AI web search · Cited live sources"
                : "Ask in plain English or Hindi · Indian SC corpus"}
            </span>
          </div>
          <Textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            className="min-h-[100px] resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAsk(); }}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">⌘ + Enter to ask</span>
            <Button onClick={() => handleAsk()} disabled={loading || !query.trim()} className="bg-primary hover:bg-primary-glow">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              {mode === "web" ? "Search the web" : "Ask"}
            </Button>
          </div>
        </div>

        {/* Sample queries */}
        {!answer && !loading && (
          <div className="mt-6">
            <p className="mb-3 font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
              Try a sample {mode === "web" ? "web search" : "case-law query"}
            </p>
            <div className="flex flex-wrap gap-2">
              {samples.map(s => (
                <button
                  key={s}
                  onClick={() => handleAsk(s)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reasoning state — animated, multi-step */}
        {loading && (
          <div className="mt-8 rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span className="font-mono text-xs uppercase tracking-wider text-primary">
                {mode === "web" ? "Doing web research…" : "Doing case-law research…"}
              </span>
            </div>
            <ol className="space-y-2 pl-1">
              {progressSteps.map((step, i) => {
                const done = i < progressStep;
                const active = i === progressStep;
                return (
                  <li
                    key={step}
                    className={`flex items-center gap-2.5 text-sm transition-opacity ${
                      done || active ? "opacity-100" : "opacity-40"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
                        done
                          ? "border-accent bg-accent text-accent-foreground"
                          : active
                          ? "border-accent text-accent"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span className={done || active ? "text-foreground" : "text-muted-foreground"}>
                      {step}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Answer */}
        {answer && !loading && (
          <div ref={answerRef} className="mt-8 animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AiDisclaimer />
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs text-muted-foreground">
                  {resultMode === "web" ? <Globe className="h-3 w-3" /> : <Scale className="h-3 w-3" />}
                  {resultMode === "web" ? "Web search" : "Case law"}
                </span>
              </div>
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

            {/* Case-law citations */}
            {resultMode === "case-law" && citations.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-4 flex items-center gap-2 font-serif text-lg font-semibold text-primary">
                  <BookOpen className="h-4 w-4 text-accent" /> Cited judgments
                </h3>
                <div className="space-y-3">
                  {citations.map((c, i) => (
                    <div key={c.id} id={`cite-${i}`} className="rounded-lg border border-border bg-card p-5">
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <h4 className="font-serif text-base font-semibold text-primary">[{i + 1}] {c.title}</h4>
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

            {/* Web sources */}
            {resultMode === "web" && webSources.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-4 flex items-center gap-2 font-serif text-lg font-semibold text-primary">
                  <Globe className="h-4 w-4 text-accent" /> Web sources
                </h3>
                <div className="space-y-3">
                  {webSources.map((s, i) => (
                    <a
                      key={`${s.url}-${i}`}
                      id={`cite-${i}`}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-lg border border-border bg-card p-5 transition-colors hover:border-accent/40"
                    >
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <h4 className="font-serif text-base font-semibold text-primary group-hover:text-accent">
                          [{i + 1}] {s.title}
                        </h4>
                        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="mb-2 font-mono text-[0.7rem] text-muted-foreground">{s.domain}</div>
                      {s.snippet && <p className="text-sm leading-relaxed text-muted-foreground">{s.snippet}</p>}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {resultMode === "web" && webSources.length === 0 && (
              <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
                <Search className="mb-1 inline h-3.5 w-3.5" /> No structured sources returned. The answer above is grounded in live web search; verify before relying on it.
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
