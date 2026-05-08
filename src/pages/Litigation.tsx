import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/AppShell";
import { AiDisclaimer } from "@/components/AiDisclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Sparkles, ExternalLink, Hash, Search, Upload, Bell, BellRing, Trash2,
  Gavel, Calendar, ScrollText, ShieldAlert, ListChecks,
} from "lucide-react";

type Mode = "cnr" | "keyword" | "document";

interface Precedent {
  tid: number;
  title: string;
  source?: string;
  date?: string;
  cited_by?: number;
  headline?: string;
  url: string;
}

interface IntelResponse {
  mode: Mode;
  brief: string;
  court_data: any;
  precedents: Precedent[];
  live_cases: any[];
  query: string;
}

interface WatchItem {
  id: string;
  kind: "cnr" | "keyword" | "competitor" | "regulator";
  label: string;
  identifier: string;
  notes?: string | null;
  last_checked_at?: string | null;
  created_at: string;
}

const SAMPLES = {
  cnr: ["DLCT010012342024", "MHCT020045672023"],
  keyword: [
    "Specific performance denied for inordinate delay",
    "Anticipatory bail under Section 438 CrPC for 498A",
    "RERA refund with interest for builder delay",
  ],
  document: [
    "Paste a notice, petition, or order text to extract issues, precedents, and a strategy memo.",
  ],
};

const Litigation = () => {
  const [mode, setMode] = useState<Mode>("cnr");
  const [cnr, setCnr] = useState("");
  const [query, setQuery] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [loading, setLoading] = useState(false);
  const [intel, setIntel] = useState<IntelResponse | null>(null);
  const [watch, setWatch] = useState<WatchItem[]>([]);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { loadWatch(); }, []);

  async function loadWatch() {
    const { data, error } = await supabase
      .from("litigation_watchlist")
      .select("id,kind,label,identifier,notes,last_checked_at,created_at")
      .order("created_at", { ascending: false });
    if (!error && data) setWatch(data as WatchItem[]);
  }

  async function runIntel() {
    if (mode === "cnr" && cnr.trim().length === 0) {
      toast.error("Enter a 16-character CNR.");
      return;
    }
    if (mode === "keyword" && query.trim().length < 5) {
      toast.error("Describe the legal issue (min 5 chars).");
      return;
    }
    if (mode === "document" && documentText.trim().length < 100) {
      toast.error("Paste at least 100 characters of document text.");
      return;
    }
    setLoading(true);
    setIntel(null);
    try {
      const { data, error } = await supabase.functions.invoke("litigation-intel", {
        body: { mode, cnr, query, documentText },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setIntel(data as IntelResponse);
    } catch (e: any) {
      toast.error(e?.message ?? "Intelligence engine failed");
    } finally {
      setLoading(false);
    }
  }

  async function trackCurrent() {
    if (!intel) return;
    const kind = intel.mode === "cnr" ? "cnr" : "keyword";
    const identifier = intel.mode === "cnr" ? cnr.toUpperCase() : (query || intel.query);
    const label =
      intel.mode === "cnr"
        ? (intel.court_data?.case?.title ?? intel.court_data?.title ?? `CNR ${identifier}`)
        : identifier.slice(0, 80);
    const { error } = await supabase.from("litigation_watchlist").insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      kind, label, identifier,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Added to watchlist");
    loadWatch();
  }

  async function refreshWatch(item: WatchItem) {
    setRefreshing(item.id);
    try {
      const body =
        item.kind === "cnr"
          ? { mode: "cnr" as const, cnr: item.identifier }
          : { mode: "keyword" as const, query: item.identifier };
      const { data, error } = await supabase.functions.invoke("litigation-intel", { body });
      if (error) throw error;
      await supabase
        .from("litigation_watchlist")
        .update({
          last_checked_at: new Date().toISOString(),
          last_snapshot: { brief: (data as any)?.brief?.slice(0, 600), court_data: (data as any)?.court_data ?? null },
        })
        .eq("id", item.id);
      toast.success(`Refreshed: ${item.label}`);
      setIntel(data as IntelResponse);
      loadWatch();
    } catch (e: any) {
      toast.error(e?.message ?? "Refresh failed");
    } finally {
      setRefreshing(null);
    }
  }

  async function removeWatch(id: string) {
    await supabase.from("litigation_watchlist").delete().eq("id", id);
    setWatch(w => w.filter(x => x.id !== id));
  }

  function onFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("File too large. Use under 2 MB or paste the text below.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDocumentText(String(reader.result ?? "").slice(0, 30000));
      setMode("document");
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
  }

  const heading = useMemo(() => {
    if (intel?.court_data?.case?.title) return intel.court_data.case.title;
    if (intel?.mode === "cnr") return `CNR ${cnr.toUpperCase()}`;
    if (intel?.mode === "keyword") return query || intel.query;
    if (intel?.mode === "document") return "Document analysis";
    return "Litigation Intelligence";
  }, [intel, cnr, query]);

  return (
    <AppShell title="Litigation Intelligence">
      <div className="container max-w-6xl py-10">
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-accent">Beta · eCourts + Indian Kanoon + Weybre AI</p>
          <h2 className="mt-2 font-serif text-3xl text-primary">One brief. Live court data, precedents, and strategy.</h2>
          <p className="mt-2 text-muted-foreground">
            Track a CNR, search by issue, or upload a document. Weybre fuses the live record with precedent and gives you a litigation playbook.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left column: input + brief */}
          <div className="space-y-6">
            <Card className="p-5">
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="cnr"><Hash className="mr-2 h-4 w-4" /> CNR</TabsTrigger>
                  <TabsTrigger value="keyword"><Search className="mr-2 h-4 w-4" /> Issue</TabsTrigger>
                  <TabsTrigger value="document"><Upload className="mr-2 h-4 w-4" /> Document</TabsTrigger>
                </TabsList>
              </Tabs>

              {mode === "cnr" && (
                <div className="mt-4 space-y-3">
                  <Input
                    placeholder="e.g. DLCT010012342024 (16 chars)"
                    value={cnr}
                    onChange={(e) => setCnr(e.target.value.toUpperCase())}
                    maxLength={20}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">CNR pulls live hearing dates, judge, last order, and matches precedents.</p>
                </div>
              )}

              {mode === "keyword" && (
                <div className="mt-4 space-y-3">
                  <Textarea
                    placeholder="Describe the legal issue, statute, or fact pattern…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="min-h-[110px]"
                  />
                </div>
              )}

              {mode === "document" && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" /> Upload .txt
                    </Button>
                    <input ref={fileRef} type="file" accept=".txt,.md,text/plain" hidden onChange={onFileUpload} />
                    <span className="text-xs text-muted-foreground">…or paste text below.</span>
                  </div>
                  <Textarea
                    placeholder="Paste petition, notice, or order text…"
                    value={documentText}
                    onChange={(e) => setDocumentText(e.target.value)}
                    className="min-h-[180px] font-mono text-xs"
                  />
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {(SAMPLES[mode] as string[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      if (mode === "cnr") setCnr(s);
                      else if (mode === "keyword") setQuery(s);
                      else setDocumentText(s);
                    }}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <AiDisclaimer />
                <Button onClick={runIntel} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Run Intelligence
                </Button>
              </div>
            </Card>

            {intel && (
              <>
                <Card className="p-6">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{intel.mode === "cnr" ? "Live case" : intel.mode === "document" ? "Document analysis" : "Issue brief"}</p>
                      <h3 className="mt-1 font-serif text-2xl text-primary">{heading}</h3>
                    </div>
                    <Button variant="outline" size="sm" onClick={trackCurrent}>
                      <Bell className="mr-2 h-4 w-4" /> Track
                    </Button>
                  </div>
                  {intel.court_data && !intel.court_data.error && (
                    <CourtSummary data={intel.court_data} />
                  )}
                  <Separator className="my-5" />
                  <div className="prose prose-sm max-w-none text-foreground prose-headings:font-serif prose-headings:text-primary prose-a:text-accent">
                    <ReactMarkdown>{intel.brief}</ReactMarkdown>
                  </div>
                </Card>

                {intel.live_cases.length > 0 && (
                  <Card className="p-5">
                    <h4 className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      <Gavel className="h-3.5 w-3.5" /> Live court records ({intel.live_cases.length})
                    </h4>
                    <div className="space-y-2">
                      {intel.live_cases.map((c: any, i) => (
                        <div key={i} className="rounded-lg border border-border bg-card p-3 text-sm">
                          <div className="font-medium text-primary">{c.title ?? c.case_title ?? "Court record"}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {c.cnr ?? c.case_number ?? ""} {c.court ?? ""} {c.last_hearing_date ?? ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>

          {/* Right column: precedents + watchlist */}
          <div className="space-y-6">
            {intel && intel.precedents.length > 0 && (
              <div>
                <p className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Cited precedents</p>
                <div className="space-y-2">
                  {intel.precedents.map((p, i) => (
                    <Card key={p.tid} className="p-3">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <Badge variant="secondary" className="shrink-0">[{i + 1}]</Badge>
                        <a href={p.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-accent">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <p className="text-sm font-medium leading-snug text-primary">{p.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.source ?? ""}{p.date ? ` · ${p.date}` : ""}{p.cited_by ? ` · cited ${p.cited_by}×` : ""}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Watchlist</p>
                <Badge variant="outline">{watch.length}</Badge>
              </div>
              {watch.length === 0 && (
                <Card className="p-4 text-sm text-muted-foreground">
                  Track a CNR or keyword to monitor for new orders, hearings, and matching judgments.
                </Card>
              )}
              <div className="space-y-2">
                {watch.map((w) => (
                  <Card key={w.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-primary">{w.label}</p>
                        <p className="text-xs text-muted-foreground">
                          <Badge variant="secondary" className="mr-1 text-[10px]">{w.kind}</Badge>
                          {w.last_checked_at ? `Checked ${new Date(w.last_checked_at).toLocaleDateString("en-IN")}` : "Not yet checked"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="icon" variant="ghost" onClick={() => refreshWatch(w)} disabled={refreshing === w.id} title="Refresh">
                          {refreshing === w.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => removeWatch(w.id)} title="Remove">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

function CourtSummary({ data }: { data: any }) {
  const c = data?.case ?? data;
  const items: { icon: any; label: string; value?: string | null }[] = [
    { icon: Calendar, label: "Next hearing", value: c?.next_hearing_date ?? c?.nextHearing ?? c?.next_date },
    { icon: Gavel, label: "Last order", value: c?.last_order_date ?? c?.lastOrderDate },
    { icon: ScrollText, label: "Stage", value: c?.stage ?? c?.case_stage },
    { icon: ListChecks, label: "Court", value: c?.court_name ?? c?.court ?? c?.bench },
  ];
  const visible = items.filter(i => i.value);
  if (visible.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3 md:grid-cols-4">
      {visible.map((i) => {
        const Icon = i.icon;
        return (
          <div key={i.label} className="rounded-md bg-background p-2">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Icon className="h-3 w-3" /> {i.label}
            </div>
            <div className="mt-1 text-sm font-medium text-primary">{i.value}</div>
          </div>
        );
      })}
    </div>
  );
}

export default Litigation;
