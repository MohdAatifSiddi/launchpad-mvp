
-- Rooms
CREATE TABLE public.diligence_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  matter_id uuid REFERENCES public.matters(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.diligence_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms_select_own" ON public.diligence_rooms FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "rooms_insert_own" ON public.diligence_rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rooms_update_own" ON public.diligence_rooms FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rooms_delete_own" ON public.diligence_rooms FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER diligence_rooms_updated_at BEFORE UPDATE ON public.diligence_rooms FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Documents
CREATE TABLE public.diligence_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.diligence_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  extracted_text text NOT NULL DEFAULT '',
  page_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'uploaded',
  error_message text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX diligence_documents_room_idx ON public.diligence_documents(room_id);
ALTER TABLE public.diligence_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_select_own" ON public.diligence_documents FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "docs_insert_own" ON public.diligence_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "docs_update_own" ON public.diligence_documents FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "docs_delete_own" ON public.diligence_documents FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Questions
CREATE TABLE public.diligence_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.diligence_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  prompt text NOT NULL,
  expected_format text NOT NULL DEFAULT 'text',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX diligence_questions_room_idx ON public.diligence_questions(room_id);
ALTER TABLE public.diligence_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q_select_own" ON public.diligence_questions FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "q_insert_own" ON public.diligence_questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "q_update_own" ON public.diligence_questions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "q_delete_own" ON public.diligence_questions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Cells
CREATE TABLE public.diligence_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.diligence_rooms(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.diligence_documents(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.diligence_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  answer text NOT NULL DEFAULT '',
  verbatim_quote text NOT NULL DEFAULT '',
  page_ref text NOT NULL DEFAULT '',
  confidence numeric NOT NULL DEFAULT 0,
  model text,
  error_message text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, question_id)
);
CREATE INDEX diligence_cells_room_idx ON public.diligence_cells(room_id);
CREATE INDEX diligence_cells_status_idx ON public.diligence_cells(status);
ALTER TABLE public.diligence_cells ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cells_select_own" ON public.diligence_cells FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "cells_insert_own" ON public.diligence_cells FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cells_update_own" ON public.diligence_cells FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cells_delete_own" ON public.diligence_cells FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER diligence_cells_updated_at BEFORE UPDATE ON public.diligence_cells FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Realtime
ALTER TABLE public.diligence_cells REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.diligence_cells;
ALTER TABLE public.diligence_documents REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.diligence_documents;

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('diligence-documents', 'diligence-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "diligence_docs_select_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'diligence-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "diligence_docs_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'diligence-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "diligence_docs_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'diligence-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "diligence_docs_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'diligence-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
