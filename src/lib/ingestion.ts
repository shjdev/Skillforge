// Shared helpers for book ingestion: PDF text extraction and chunking.
// Used by both /api/admin/analyze-book (document analysis pass) and
// /api/admin/ingest-pdf (lesson generation) so chunk boundaries stay identical.

import { get } from '@vercel/blob';
import { GoogleGenAI } from '@google/genai';

export const CHUNK_SIZE = 14_000;
export const BASE_CHUNKS = 15;
export const PLAN_OVERVIEW_CHARS = 900;
const OCR_MODEL = 'gemini-3.6-flash';
const INLINE_PDF_MAX_BYTES = 18 * 1024 * 1024;
const MIN_TEXT_CHARS = 500;

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

export function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

/**
 * Fallback multimodal via Gemini Vision lorsqu'un PDF est scanné (images sans
 * couche texte exploitable par `pdf-parse`). Envoie le PDF en inline base64
 * jusqu'à 18 Mo, ou via l'API Files de Gemini au-delà.
 */
export async function extractPdfTextWithGemini(buffer: Buffer, apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const prompt =
    'Ce fichier PDF est un ouvrage scanné ou sans couche texte. ' +
    'Transcris intégralement et fidèlement son contenu pédagogique (titres de chapitres, paragraphes explicatifs, définitions, exemples, code et formules) ' +
    "dans l'ordre du document, sous forme de texte brut structuré, sans commentaire méta.";

  if (buffer.length <= INLINE_PDF_MAX_BYTES) {
    const response = await ai.models.generateContent({
      model: OCR_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } },
            { text: prompt },
          ],
        },
      ],
    });
    return (response.text || '').trim();
  }

  let uploadedName: string | undefined;
  try {
    const blob = new Blob([new Uint8Array(buffer)], { type: 'application/pdf' });
    const uploaded = await ai.files.upload({
      file: blob,
      config: { mimeType: 'application/pdf' },
    });
    uploadedName = uploaded.name;
    if (!uploaded.uri) return '';

    const response = await ai.models.generateContent({
      model: OCR_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri: uploaded.uri, mimeType: 'application/pdf' } },
            { text: prompt },
          ],
        },
      ],
    });
    return (response.text || '').trim();
  } finally {
    if (uploadedName) {
      await ai.files.delete({ name: uploadedName }).catch(() => {});
    }
  }
}

export async function extractPdfText(buffer: Buffer, options?: { apiKey?: string }): Promise<string> {
  let text = '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(buffer);
    text = pdfData?.text || '';
  } catch (err) {
    console.warn('PDF parsing fallback to raw text extraction:', err);
    const raw = buffer.toString('utf8');
    text = /[a-zA-Zàâçéèêëîïôùû]{4,}[\s.]/.test(raw.slice(0, 2000)) ? raw : '';
  }

  if (text.trim().length >= MIN_TEXT_CHARS) {
    return text;
  }

  const resolvedApiKey = options?.apiKey || process.env.GEMINI_API_KEY;
  if (resolvedApiKey && isPdfBuffer(buffer)) {
    try {
      console.info('[ingestion] Couche texte absente ou trop courte (< 500 car.) : extraction multimodale via Gemini Vision…');
      const ocrText = await extractPdfTextWithGemini(buffer, resolvedApiKey);
      if (ocrText.length > text.trim().length) {
        return ocrText;
      }
    } catch (ocrErr) {
      console.warn('[ingestion] Échec du fallback OCR Gemini :', ocrErr);
    }
  }

  return text;
}

/**
 * Downloads a file previously uploaded straight from the browser to Vercel
 * Blob (bypassing the ~4.5 MB request body limit of a Vercel serverless
 * function) so it can be processed here exactly like a directly-posted file.
 * The store is private, so the read goes through the SDK with the server's
 * BLOB_READ_WRITE_TOKEN; only URLs on Vercel Blob hosts are accepted, so a
 * client can't make the server fetch an arbitrary address.
 */
export async function fetchBlobBuffer(url: string): Promise<Buffer> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('URL de fichier invalide.');
  }
  if (!host.endsWith('.blob.vercel-storage.com')) {
    throw new Error("URL de fichier refusée : elle ne pointe pas vers le stockage Vercel Blob de l'application.");
  }
  const result = await get(url, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) {
    throw new Error("Fichier introuvable à l'URL fournie (lien expiré ou supprimé ?).");
  }
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
