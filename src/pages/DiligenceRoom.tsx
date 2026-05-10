import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Play, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AiDisclaimer } from "@/components/AiDisclaimer";
import { DocumentDropzone, DDoc } from "@/components/diligence/DocumentDropzone";
import { QuestionPlaybook, DQuestion } from "@/components/diligence/QuestionPlaybook";
import { CellSidePanel, CellPanelData } from "@/components/diligence/CellSidePanel";

interface Cell {
  id: string; document_id: string; question_id: string;
  status: "pending" | "running" | "done" | "error";
  answer: string; verbatim_quote: string; page_ref: string; confidence: number;
  model: string | null; error_message: string | null;
}

const COL_W = 260;
const ROW_H = 96;
const ROW_LABEL_W = 220;

const DiligenceRoom = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [room, setRoom] = useState<any>(null);
  const [docs, setDocs] = useState<DDoc[]>([]);
  const [questions, setQuestions] = useState<DQuestion[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [panel, setPanel] = useState<CellPanelData | null>(null);

  const cellMap = useMemo(() => {
    const m = new Map<string, Cell>();
    cells.forEach(c => m.set(`${c.document_id}|${c.question_id}`, c));
    return m;
  }, [cells]);

  // Initial load
  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const [{ data: r }, { data: ds }, { data: qs }, { data: cs }] = await Promise.all([
        (supabase as any).from("diligence_rooms").select("*").eq("id", id).maybeSingle(),
        (supabase as any).from("diligence_documents").select("id,file_name,storage_path,mime_type,file_size,status,page_count").eq("room_id", id).order("created_at"),
        (supabase as any).from("diligence_questions").select("id,label,prompt,expected_format,position").eq("room_id", id).order("position"),
        (supabase as any).from("diligence_cells").select("id,document_id,question_id,status,answer,verbatim_quote,page_ref,confidence,model,error_message").eq("room_id", id),
      ]);
      setRoom(r);
      setDocs((ds ?? []) as DDoc[]);
      setQuestions((qs ?? []) as DQuestion[]);
      setCells((cs ?? []) as Cell[]);
      setLoading(false);
    })();
  }, [id, user]);

  // Realtime: cells
  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`diligence:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "diligence_cells", filter: `room_id=eq.${id}` }, (payload: any) => {
        setCells(prev => {
          if (payload.eventType === "DELETE") return prev.filter(c => c.id !== payload.old.id);
          const row = payload.new as Cell;
          const idx = prev.findIndex(c => c.id === row.id);
          if (idx === -1) return [...prev, row];
          const next = prev.slice(); next[idx] = row; return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  const totalCells = docs.length * questions.length;
  const doneCells = cells.filter(c => c.status === "done").length;
  const errorCells = cells.filter(c => c.status === "error").length;
  const pendingOrRunning = cells.filter(c => c.status === "pending" || c.status === "running").length;

  // Run extraction
  const runAll = async () => {
    if (!id || !user) return;
    if (!docs.length || !questions.length) {
      toast.error("Add at least one document and one question");
      return;
    }
    setRunning(true);
    try {
      // Create missing pending cells
      const missing: any[] = [];
      for (const d of docs) for (const q of questions) {
        if (!cellMap.has(`${d.id}|${q.id}`)) {
          missing.push({ room_id: id, user_id: user.id, document_id: d.id, question_id: q.id, status: "pending" });
        }
      }
      if (missing.length) {
        const { data, error } = await (supabase as any).from("diligence_cells").insert(missing)
          .select("id,document_id,question_id,status,answer,verbatim_quote,page_ref,confidence,model,error_message");
        if (error) throw error;
        setCells(prev => [...prev, ...((data ?? []) as Cell[])]);
      }

      // Worker loop — keep invoking until no pending remain
      while (true) {
        const { data, error } = await supabase.functions.invoke("diligence-run", { body: { room_id: id } });
        if (error) throw error;
        if (!data || (data.processed === 0 && data.remaining === 0)) break;
        if (data.remaining === 0) break;
      }
      toast.success("Extraction complete");
    } catch (e: any) {
      toast.error("Run failed", { description: e?.message });
    } finally {
      setRunning(false);
    }
  };

  const retryCell = async (cellId: string) => {
    try {
      const { error } = await (supabase as any).from("diligence_cells").update({
        status: "pending", error_message: null, answer: "", verbatim_quote: "", page_ref: "", confidence: 0,
      }).eq("id", cellId);
      if (error) throw error;
      setPanel(null);
      const { error: invErr } = await supabase.functions.invoke("diligence-run", { body: { room_id: id } });
      if (invErr) throw invErr;
    } catch (e: any) {
      toast.error("Retry failed", { description: e?.message });
    }
  };

  const exportCsv = async () => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/diligence-export?room_id=${id}`;
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${room?.name ?? "diligence"}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      toast.error("Export failed", { description: e?.message });
    }
  };

  // Virtualized rows
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: docs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 6,
  });

  if (loading) return <AppShell><div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div></AppShell>;
  if (!room) return <AppShell><div className="container py-10">Room not found.</div></AppShell>;

  const progress = totalCells === 0 ? 0 : Math.round(((doneCells + errorCells) / totalCells) * 100);

  return (
    <AppShell>
      <div className="container max-w-[1400px] py-6">
        <Link to="/app/diligence" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All rooms
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-accent">Diligence room</p>
            <h1 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-primary">{room.name}</h1>
            {room.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{room.description}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={totalCells === 0}>
              <Download className="h-4 w-4" />CSV
            </Button>
            <Button size="sm" onClick={runAll} disabled={running || !docs.length || !questions.length} className="bg-primary hover:bg-primary-glow">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Run extraction
            </Button>
          </div>
        </div>

        <div className="mt-4"><AiDisclaimer /></div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <DocumentDropzone roomId={id!} userId={user!.id} docs={docs} onChange={setDocs} />
            <QuestionPlaybook roomId={id!} userId={user!.id} questions={questions} onChange={setQuestions} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{doneCells} / {totalCells} extracted{errorCells > 0 ? ` · ${errorCells} errors` : ""}{pendingOrRunning > 0 ? ` · ${pendingOrRunning} in progress` : ""}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1 w-full bg-muted">
              <div className="h-1 bg-accent transition-all" style={{ width: `${progress}%` }} />
            </div>

            {totalCells === 0 ? (
              <div className="border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                Upload documents and add questions, then click <strong className="text-foreground">Run extraction</strong>.
              </div>
            ) : (
              <div className="border border-border bg-card">
                {/* Header row */}
                <div className="flex border-b border-border bg-muted/40">
                  <div className="shrink-0 border-r border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ width: ROW_LABEL_W }}>Document</div>
                  <div className="flex overflow-x-auto">
                    {questions.map(q => (
                      <div key={q.id} className="shrink-0 border-r border-border px-3 py-2 text-xs font-semibold text-foreground" style={{ width: COL_W }} title={q.prompt}>
                        {q.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Virtualized body */}
                <div ref={scrollRef} className="max-h-[600px] overflow-auto">
                  <div style={{ height: rowVirtualizer.getTotalSize(), width: ROW_LABEL_W + questions.length * COL_W, position: "relative" }}>
                    {rowVirtualizer.getVirtualItems().map(vr => {
                      const d = docs[vr.index];
                      return (
                        <div key={d.id} className="absolute left-0 top-0 flex border-b border-border" style={{ transform: `translateY(${vr.start}px)`, height: ROW_H, width: "100%" }}>
                          <div className="shrink-0 border-r border-border bg-card px-3 py-2 text-sm" style={{ width: ROW_LABEL_W }}>
                            <p className="truncate font-medium text-foreground" title={d.file_name}>{d.file_name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{d.page_count} pages</p>
                          </div>
                          {questions.map(q => {
                            const c = cellMap.get(`${d.id}|${q.id}`);
                            const status = c?.status ?? "empty";
                            return (
                              <button
                                key={q.id}
                                type="button"
                                onClick={() => c && setPanel({
                                  cellId: c.id,
                                  documentName: d.file_name,
                                  questionLabel: q.label,
                                  questionPrompt: q.prompt,
                                  status: c.status, answer: c.answer, verbatim_quote: c.verbatim_quote,
                                  page_ref: c.page_ref, confidence: c.confidence, model: c.model, error_message: c.error_message,
                                })}
                                className={`shrink-0 border-r border-border px-3 py-2 text-left text-xs leading-snug transition-colors ${c ? "hover:bg-accent/10" : "cursor-default"}`}
                                style={{ width: COL_W, height: ROW_H }}
                              >
                                {status === "done" && <p className="line-clamp-4 text-foreground">{c!.answer}</p>}
                                {status === "running" && <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> running…</span>}
                                {status === "pending" && <span className="text-muted-foreground">queued…</span>}
                                {status === "error" && <span className="inline-flex items-center gap-1 text-destructive"><AlertCircle className="h-3 w-3" /> error</span>}
                                {status === "empty" && <span className="text-muted-foreground/60">—</span>}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <CellSidePanel data={panel} onClose={() => setPanel(null)} onRetry={retryCell} />
    </AppShell>
  );
};

export default DiligenceRoom;
