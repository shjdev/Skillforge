// Shared helpers for book ingestion: PDF text extraction and chunking.
// Used by both /api/admin/analyze-book (document analysis pass) and
// /api/admin/ingest-pdf (lesson generation) so chunk boundaries stay identical.

export const CHUNK_SIZE = 14_000;
export const BASE_CHUNKS = 15;
export const PLAN_OVERVIEW_CHARS = 900;

export interface TextChunk {
  content: string;
  index: number;
}

export function chunkText(text: string, maxChunks: number): TextChunk[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const chunks: TextChunk[] = [];
  for (let i = 0; i < clean.length && chunks.length < maxChunks; i += CHUNK_SIZE) {
    let end = Math.min(i + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      const lastStop = clean.lastIndexOf('. ', end);
      if (lastStop > i + CHUNK_SIZE * 0.5) end = lastStop + 1;
    }
    chunks.push({ content: clean.slice(i, end), index: chunks.length + 1 });
  }
  return chunks;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(buffer);
    const text = pdfData?.text || '';
    if (text.trim().length < 500 && buffer.length > 1024 * 1024) {
      console.warn('[ingestion] Texte extrait quasi vide pour un gros fichier : PDF probablement scanné (images).');
    }
    return text;
  } catch (err) {
    console.warn('PDF parsing fallback to raw text extraction:', err);
    const raw = buffer.toString('utf8');
    return /[a-zA-Zàâçéèêëîïôùû]{4,}[\s.]/.test(raw.slice(0, 2000))
      ? raw
      : '';
  }
}

/**
 * Downloads a file previously uploaded straight from the browser to Vercel
 * Blob (bypassing the ~4.5 MB request body limit of a Vercel serverless
 * function) so it can be processed here exactly like a directly-posted file.
 */
export async function fetchBlobBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fichier introuvable à l'URL fournie (lien expiré ou supprimé ?).");
  return Buffer.from(await res.arrayBuffer());
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
