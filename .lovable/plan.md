# Diligence Module (Specter-style) — MVP for Weybre AI

A new **Diligence** workspace where lawyers upload many documents, define a list of questions (a "playbook"), and get an AI-extracted answer + verbatim quote + page reference for every (document × question) cell. Designed for Indian M&A / contract review.

This is a large feature; the MVP focuses on the matrix workflow end-to-end. Advanced items (real-time multiplayer cursors, anomaly detection, market benchmarking, fine-tuning) are explicitly out of scope for v1 and listed under "Later".

---

## User flow

1. **Diligence Rooms** list (`/app/diligence`) — create a Room (e.g. "Project Phoenix — Target NDA review").
2. Inside a Room (`/app/diligence/:id`):
   - **Documents** panel: drag-drop PDFs / DOCX / TXT (uses existing extractor logic from DraftEditor). Each doc shows status: `uploading → parsing → ready`.
   - **Playbook** panel: add questions manually or pick a template (NDA, Lease, SPA, Employment, Vendor MSA — Indian-law slanted).
   - **Run** button: enqueues one extraction job per (doc × question) cell.
   - **Grid** (the centerpiece): rows = documents, cols = questions. Each cell streams from `pending → running → done|error` and shows the answer.
   - **Side panel** (right): click a cell → verbatim quote, page number, confidence, source doc name. "Open document" jumps to the parsed text with the snippet highlighted.
   - **Export**: CSV of the matrix; PDF summary using existing `exportPdf.ts`.

---

## Architecture (mapped to Lovable Cloud)

Specter spec → what we actually use:

| Specter | Weybre MVP |
|---|---|
| API Gateway + SQS queues | Edge functions + Postgres job rows polled by a worker function |
| OCR / parse | Existing client-side pdfjs + mammoth (reuse from DraftEditor); store extracted text per doc |
| Vector DB (Qdrant) | Postgres `pgvector` (already enabled — used by `judgments`) |
| GPT-4o primary, Claude fallback | Lovable AI Gateway: `google/gemini-2.5-pro` primary, `openai/gpt-5-mini` fallback |
| WebSocket bus | Supabase Realtime on the `diligence_cells` table |
| TanStack Virtual grid | Same — `@tanstack/react-virtual` for rows |
| Jotai atomFamily | Keep it simple: Zustand-free, just Realtime → React state. Add Jotai only if perf demands it. |
| RLS multi-tenant | Standard `auth.uid() = user_id` policies (matches rest of app) |

Async boundary: the "Run" button writes N `pending` cell rows then invokes a `diligence-run` edge function that fans out extraction in batches (≤ 8 concurrent LLM calls per invocation, looped). Each cell is independently retryable; failures move to `error` with `error_message` and a "Retry" action.

---

## Database (single migration)

```text
diligence_rooms      (id, user_id, matter_id?, name, description, created_at, updated_at)
diligence_documents  (id, room_id, user_id, file_name, storage_path, mime_type,
                      file_size, extracted_text, page_count, status, error_message, created_at)
diligence_questions  (id, room_id, user_id, position, label, prompt, expected_format, created_at)
diligence_cells      (id, room_id, document_id, question_id, user_id,
                      status('pending'|'running'|'done'|'error'),
                      answer, verbatim_quote, page_ref, confidence,
                      model, error_message, updated_at)
                      UNIQUE (document_id, question_id)
```

- Storage bucket `diligence-documents` (private), policies mirror `draft-documents`.
- RLS: owner-only on all four tables (`auth.uid() = user_id`), plus admin override.
- Realtime publication added on `diligence_cells` so the grid streams updates.

---

## Edge functions

- **`diligence-run`** — input `{ room_id, cell_ids? }`. Loads doc text + question prompt, calls Gemini with a strict JSON schema `{ answer, verbatim_quote, page_ref, confidence }`, updates the cell. Includes a clause-aware chunker: splits doc into ~2k-token sections and asks the model to pick the most relevant section first (cheap mini model), then extract from that section only (keeps cost predictable).
- **`diligence-export`** — returns CSV of the matrix.
- Reuses existing `LOVABLE_API_KEY`. No new secrets.

---

## Frontend

New files:
- `src/pages/Diligence.tsx` — rooms list.
- `src/pages/DiligenceRoom.tsx` — main grid view (TanStack Virtual rows, sticky left col = doc name, sticky header = questions, click cell to open side panel).
- `src/components/diligence/QuestionPlaybook.tsx` — add/edit/reorder questions; "Load template" dropdown (NDA / Lease / SPA / Employment / Vendor MSA).
- `src/components/diligence/DocumentDropzone.tsx` — upload + parse + insert row.
- `src/components/diligence/CellSidePanel.tsx` — verbatim, page, confidence, retry.
- `src/lib/diligenceTemplates.ts` — built-in question packs.
- Route added to `App.tsx`; nav link added in `AppShell`.

Reuses: existing `extractTextFromFile` (lift from `DraftEditor.tsx` into `src/lib/docExtract.ts`), `AiDisclaimer`, `exportAiResultPdf`.

Design tokens only (navy/ivory/saffron, Fraunces headings) — no raw colors.

---

## Out of scope (Later)

- Real-time presence cursors / comments per cell
- Cross-doc agentic reasoning (deal-level questions)
- Anomaly detection vs. corpus, market benchmarking
- Fine-tuning from corrections
- Air-gapped / on-prem LLM option
- DLQ + multi-provider auto-failover beyond single fallback model

---

## Build order

1. Migration (tables + storage bucket + RLS + realtime publication). **Approval gate.**
2. `diligence-run` and `diligence-export` edge functions.
3. Lift `extractTextFromFile` into shared lib.
4. `Diligence` rooms list + create flow.
5. `DiligenceRoom` with upload + playbook + virtualized grid + Realtime subscription.
6. Side panel + retry + CSV/PDF export.
7. Add nav entry + route guards.

Ship in that order; each step is independently testable.