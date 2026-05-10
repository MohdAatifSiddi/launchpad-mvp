import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText } from "lucide-react";

export interface CellPanelData {
  cellId: string;
  documentName: string;
  questionLabel: string;
  questionPrompt: string;
  status: string;
  answer: string;
  verbatim_quote: string;
  page_ref: string;
  confidence: number;
  model?: string | null;
  error_message?: string | null;
}

export const CellSidePanel = ({ data, onClose, onRetry }: { data: CellPanelData | null; onClose: () => void; onRetry: (cellId: string) => void; }) => {
  return (
    <Sheet open={!!data} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        {data && (
          <>
            <SheetHeader>
              <p className="font-mono text-xs uppercase tracking-wider text-accent">{data.documentName}</p>
              <SheetTitle className="font-serif text-lg text-primary">{data.questionLabel}</SheetTitle>
              <p className="text-sm text-muted-foreground">{data.questionPrompt}</p>
            </SheetHeader>

            <div className="mt-5 space-y-5">
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Answer</h4>
                {data.status === "error" ? (
                  <p className="text-sm text-destructive">{data.error_message || "Extraction failed"}</p>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{data.answer || "—"}</p>
                )}
              </div>

              {data.verbatim_quote && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verbatim quote</h4>
                  <blockquote className="border-l-2 border-accent bg-card p-3 font-serif text-sm italic leading-relaxed text-foreground">
                    "{data.verbatim_quote}"
                  </blockquote>
                </div>
              )}

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {data.page_ref && <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />{data.page_ref}</span>}
                {data.status === "done" && <span>Confidence: {Math.round(data.confidence * 100)}%</span>}
                {data.model && <span>Model: {data.model}</span>}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onRetry(data.cellId)}>
                  <RefreshCw className="h-4 w-4" />Re-run cell
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
