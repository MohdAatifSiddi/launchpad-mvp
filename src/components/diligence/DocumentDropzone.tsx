import { ChangeEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, FileText, Trash2 } from "lucide-react";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_SIZE, extractTextFromFile, formatFileSize } from "@/lib/docExtract";
import { toast } from "sonner";

export interface DDoc { id: string; file_name: string; storage_path: string; mime_type: string; file_size: number; status: string; page_count: number; }

export const DocumentDropzone = ({ roomId, userId, docs, onChange }: {
  roomId: string; userId: string; docs: DDoc[]; onChange: (d: DDoc[]) => void;
}) => {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    setBusy(true);
    const inserted: DDoc[] = [];
    for (const file of files) {
      try {
        if (file.size > MAX_UPLOAD_SIZE) { toast.error(`${file.name}: too large`); continue; }
        if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) { toast.error(`${file.name}: unsupported type`); continue; }

        const { text, pageCount } = await extractTextFromFile(file);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${userId}/${roomId}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from("diligence-documents").upload(storagePath, file, {
          contentType: file.type, upsert: false,
        });
        if (upErr) throw upErr;

        const { data, error } = await (supabase as any).from("diligence_documents").insert({
          room_id: roomId, user_id: userId, file_name: file.name, storage_path: storagePath,
          mime_type: file.type, file_size: file.size, extracted_text: text,
          page_count: pageCount, status: text ? "ready" : "uploaded", position: docs.length + inserted.length,
        }).select("id,file_name,storage_path,mime_type,file_size,status,page_count").single();
        if (error) throw error;
        inserted.push(data as DDoc);
      } catch (err: any) {
        toast.error(`${file.name}: ${err?.message ?? err}`);
      }
    }
    if (inserted.length) onChange([...docs, ...inserted]);
    setBusy(false);
  };

  const removeDoc = async (doc: DDoc) => {
    try {
      await supabase.storage.from("diligence-documents").remove([doc.storage_path]);
      const { error } = await (supabase as any).from("diligence_documents").delete().eq("id", doc.id);
      if (error) throw error;
      onChange(docs.filter(d => d.id !== doc.id));
    } catch (e: any) { toast.error("Remove failed", { description: e?.message }); }
  };

  return (
    <div className="border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-base font-semibold text-primary">Documents ({docs.length})</h3>
        <input ref={inputRef} type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.txt,.md,.rtf" onChange={handleFiles} />
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Upload
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        {docs.map(d => (
          <div key={d.id} className="flex items-center justify-between gap-2 border border-border bg-background px-3 py-2 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{d.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(d.file_size)} · {d.page_count} pages · {d.status}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => removeDoc(d)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
};
