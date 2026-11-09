import { del, get } from '@vercel/blob';

// Fichiers importés via Vercel Blob (store privé). Chaque utilisateur dépose
// sous imports/<userId>/ : le serveur refuse de relire un fichier hors de ce
// dossier, et le supprime dès que son texte est extrait.

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function uploadPrefix(userId: string): string {
  return `imports/${userId}/`;
}

/** Vérifie qu'une URL pointe vers le Blob store, dans le dossier de l'utilisateur. */
export function assertOwnBlobUrl(url: string, userId: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('URL de fichier invalide.');
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.blob.vercel-storage.com')) {
    throw new Error("URL de fichier refusée : elle ne pointe pas vers le stockage de l'application.");
  }
  if (!decodeURIComponent(parsed.pathname).startsWith(`/${uploadPrefix(userId)}`)) {
    throw new Error('Ce fichier ne vous appartient pas.');
  }
  return parsed;
}

export async function fetchBlobBuffer(url: string): Promise<Buffer> {
  const result = await get(url, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) {
    throw new Error('Fichier introuvable (lien expiré ou supprimé ?). Importez-le à nouveau.');
  }
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

/** Suppression best-effort : un échec n'interrompt pas l'import. */
export async function deleteBlob(url: string): Promise<void> {
  try {
    await del(url);
  } catch (err) {
    console.warn('[import] Suppression du fichier temporaire impossible :', err);
  }
}
