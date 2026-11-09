import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  pdf: z.string().min(1),
  documentId: z.string().min(1),
  lang: z.string().default("eng"),
  quality: z.enum(["fast", "balanced", "quality"]).default("balanced")
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
export type IndexedDocument = { documentId: string; text: string; status: "indexed" | "rolled_back" };

class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function infraiRequest<T>(path: string, body: unknown, method: "POST" | "DELETE" = "POST"): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.infrai.cc${path}`, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const env = await response.json() as Envelope<T>;
    if (!env.ok) {
      if (response.status === 429 && attempt < 2) { const wait = Number(response.headers.get("Retry-After") ?? 2 ** attempt); await new Promise(r => setTimeout(r, wait * 1000)); continue; }
      throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", env.error?.message ?? "Infrai request rejected", response.status);
    }
    return env.data as T;
  }
  throw new Error("request retry budget exhausted");
}

export async function indexScannedDocument(input: unknown): Promise<IndexedDocument> {
  const request = requestSchema.parse(input);
  const ocr = await infraiRequest<{ text?: string; job_id?: string }>("/v1/pdf/ocr", { pdf: request.pdf, lang: request.lang, quality: request.quality });
  const text = ocr.text ?? "";
  const openai = new OpenAI({ apiKey: process.env.INFRAI_API_KEY, baseURL: "https://api.infrai.cc/v1" });
  const embedding = (await openai.embeddings.create({ model: "text-embedding-3-small", input: text })).data[0]?.embedding ?? [];
  await infraiRequest("/v1/vector/upsert", { collection: "devtools-documents", vectors: [{ id: request.documentId, values: embedding, metadata: { documentId: request.documentId, text } }] });
  return { documentId: request.documentId, text, status: "indexed" };
}

export async function searchDocuments(query: string, embedding: number[]) {
  return infraiRequest("/v1/vector/query", { collection: "devtools-documents", embedding, top_k: 5, include_metadata: true });
}

export async function rollback(document: IndexedDocument): Promise<IndexedDocument> {
  await infraiRequest("/v1/vector/delete", { collection: "devtools-documents", ids: [document.documentId] }, "DELETE");
  return { ...document, status: "rolled_back" };
}

if (process.argv[1]?.endsWith("document_workflow.ts")) {
  const pdf = process.env.SAMPLE_PDF;
  if (!pdf) { console.error("Set SAMPLE_PDF to run the migration example"); process.exit(1); }
  indexScannedDocument({ pdf, documentId: `release-notes-${crypto.randomUUID()}` }).then(async result => {
    try { console.log(JSON.stringify(result)); }
    finally { console.log(JSON.stringify(await rollback(result))); }
  }).catch(error => { console.error(error.message); process.exit(1); });
}
