import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { del } from '@vercel/blob';

/**
 * Issues client tokens for direct browser → Vercel Blob uploads, so a book
 * PDF never has to pass through our serverless function's ~4.5 MB request
 * body limit (see analyze-book / ingest-pdf, which read the file back from
 * the resulting Blob URL instead of a multipart `file` field).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['application/pdf', 'text/plain'],
        addRandomSuffix: true,
        maximumSizeInBytes: 300 * 1024 * 1024,
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Échec du téléversement.' }, { status: 400 });
  }
}

// Nettoyage best-effort du fichier temporaire une fois l'analyse/génération
// terminée (ou abandonnée) côté client — pas critique si ça échoue.
export async function DELETE(request: Request): Promise<NextResponse> {
  const { url } = (await request.json()) as { url?: string };
  if (!url) return NextResponse.json({ error: 'URL manquante.' }, { status: 400 });
  try {
    await del(url);
  } catch (error) {
    console.warn('[blob-upload] Échec de la suppression du blob temporaire :', error);
  }
  return NextResponse.json({ success: true });
}
