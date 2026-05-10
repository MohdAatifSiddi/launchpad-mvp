import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import mammoth from "mammoth/mammoth.browser";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "application/rtf",
];

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export interface ExtractedDoc { text: string; pageCount: number; }

export const extractTextFromFile = async (file: File): Promise<ExtractedDoc> => {
  if (file.type === "text/plain" || file.type === "text/markdown" || file.type === "application/rtf") {
    const text = (await file.text()).slice(0, 200000);
    return { text, pageCount: Math.max(1, Math.ceil(text.length / 3000)) };
  }
  if (file.type === "application/pdf") {
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    const max = Math.min(pdf.numPages, 200);
    for (let p = 1; p <= max; p += 1) {
      const page = await pdf.getPage(p);
      const t = await page.getTextContent();
      pages.push(`[Page ${p}]\n` + t.items.map((it: any) => it.str).join(" "));
    }
    return { text: pages.join("\n\n").slice(0, 400000), pageCount: pdf.numPages };
  }
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const text = r.value.slice(0, 400000);
    return { text, pageCount: Math.max(1, Math.ceil(text.length / 3000)) };
  }
  return { text: "", pageCount: 0 };
};
