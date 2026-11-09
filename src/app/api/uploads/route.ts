import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getSessionContext } from '@/lib/serverAuth';
import { isBlobConfigured, uploadPrefix } from '@/lib/import/blob';
import { ACCEPTED_MIME_TYPES, MAX_FILE_BYTES } from '@/lib/import/text';

/**
 * GET : comment envoyer le fichier. « blob » = téléversement direct du
 * navigateur vers Vercel Blob (contourne la limite de ~4,5 Mo des fonctions) ;
 * « direct » = envoi dans la requête d'import (développement local).
 */
export async function GET() {
  return NextResponse.json({ mode: isBlobConfigured() ? 'blob' : 'direct', maxBytes: MAX_FILE_BYTES });
}

/** POST : jeton de téléversement, limité au dossier de l'utilisateur. */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isBlobConfigured()) {
    return NextResponse.json({ error: 'Stockage de fichiers non configuré sur le serveur.' }, { status: 500 });
  }
  const { userId } = await getSessionContext();
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(uploadPrefix(userId)) || pathname.includes('..')) {
          throw new Error('Emplacement de fichier refusé.');
        }
        return {
          allowedContentTypes: [...ACCEPTED_MIME_TYPES],
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Échec du téléversement.' },
      { status: 400 },
    );
  }
}
