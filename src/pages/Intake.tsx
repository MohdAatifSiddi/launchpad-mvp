import { useCallback, useEffect, useState } from "react";
import { Upload, Loader2, FileText, AlertTriangle, CheckCircle2, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AiDisclaimer } from "@/components/AiDisclaimer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Contract = {
  id: string;
  file_name: string;
  mime_type: string;
  status: string;
  error_message: string | null;
  doc_type: string | null;
  doc_type_confidence: number;
  jurisdiction: string | null;
  governing_law: string | null;
  risk_level: string | null;
  risk_reasons: string[];
  parties: string[];
  effective_date: string | null;
  expiry_date: string | null;
  renewal_window: string | null;
  termination_clause: string | null;
  char_count: number;
  needs_human_review: boolean;
  created_at: string;
  storage_path: string;
};

const riskTone = (r: string | null) =>
  r === "HIGH" ? "destructive" : r === "MEDIUM" ? "default" : "secondary";

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt";

const Intake = () => {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) toast.error(error.message);
    else setContracts((data ?? []) as Contract[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("contracts:" + user.id)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "contracts", filter: `user_id=eq.${user.id}` },
        () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, load]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";
    if (file.size > 20 * 1024 * 1024) { toast.error("Max 20 MB"); return; }

    setUploading(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("contract-intake")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: row, error: insErr } = await supabase.from("contracts").insert({
        user_id: user.id,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        status: "uploaded",
      }).select("id").single();
      if (insErr) throw insErr;

      toast.success("Uploaded — classifying…");
      void supabase.functions.invoke("contract-intake", { body: { contractId: row.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const retry = async (c: Contract) => {
    await supabase.from("contracts").update({ status: "processing", error_message: null }).eq("id", c.id);
    void supabase.functions.invoke("contract-intake", { body: { contractId: c.id } });
  };

  const remove = async (c: Contract) => {
    await supabase.storage.from("contract-intake").remove([c.storage_path]);
    await supabase.from("contracts").delete().eq("id", c.id);
  };

  return (
    <AppShell title="Contract Intake">
      <div className="container max-w-6xl space-y-6 py-8">
        <Card className="p-6">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-serif text-xl text-primary">Drop a contract. Get it classified.</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                PDF, DOCX, scanned image or text. The agent extracts parties, dates,
                jurisdiction, governing law, renewal & termination, and flags risk.
              </p>
            </div>
            <label>
              <input type="file" accept={ACCEPTED} className="hidden" onChange={onPick} disabled={uploading} />
              <Button asChild disabled={uploading}>
                <span className="cursor-pointer">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Uploading…" : "Upload contract"}
                </span>
              </Button>
            </label>
          </div>
          <AiDisclaimer className="mt-4" />
        </Card>

        <div className="space-y-3">
          {contracts.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No contracts yet. Upload one to begin.
            </Card>
          )}
          {contracts.map((c) => <Row key={c.id} c={c} onRetry={retry} onRemove={remove} />)}
        </div>
      </div>
    </AppShell>
  );
};

const Row = ({ c, onRetry, onRemove }: { c: Contract; onRetry: (c: Contract) => void; onRemove: (c: Contract) => void }) => {
  const processing = c.status === "uploaded" || c.status === "processing";
  const failed = c.status === "failed";
  const review = c.status === "needs_review" || c.needs_human_review;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="truncate font-medium text-primary">{c.file_name}</p>
            {processing && <Badge variant="secondary"><Loader2 className="h-3 w-3 animate-spin" /> Classifying</Badge>}
            {failed && <Badge variant="destructive"><AlertTriangle className="h-3 w-3" /> Failed</Badge>}
            {review && !processing && !failed && <Badge variant="default"><AlertTriangle className="h-3 w-3" /> Review</Badge>}
            {c.status === "ready" && <Badge variant="secondary"><CheckCircle2 className="h-3 w-3" /> Ready</Badge>}
            {c.doc_type && <Badge variant="outline">{c.doc_type} · {(c.doc_type_confidence * 100).toFixed(0)}%</Badge>}
            {c.risk_level && <Badge variant={riskTone(c.risk_level) as never}>{c.risk_level} risk</Badge>}
          </div>

          {failed && c.error_message && (
            <p className="mt-2 text-sm text-destructive">{c.error_message}</p>
          )}

          {(c.status === "ready" || review) && (
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <Field label="Parties" value={c.parties?.length ? c.parties.join(", ") : "—"} />
              <Field label="Jurisdiction" value={c.jurisdiction ?? "—"} />
              <Field label="Governing law" value={c.governing_law ?? "—"} />
              <Field label="Effective → expiry" value={`${c.effective_date ?? "—"}  →  ${c.expiry_date ?? "—"}`} />
              {c.renewal_window && <Field label="Renewal" value={c.renewal_window} />}
              {c.termination_clause && <Field label="Termination" value={c.termination_clause} />}
              {c.risk_reasons?.length > 0 && (
                <div className="md:col-span-2">
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Risk flags</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {c.risk_reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-1">
          {failed && (
            <Button variant="ghost" size="icon" onClick={() => onRetry(c)} title="Retry">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => onRemove(c)} title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-foreground">{value}</p>
  </div>
);

export default Intake;
