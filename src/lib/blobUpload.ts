import { upload } from '@vercel/blob/client';

// Au-delà de ce seuil, le fichier est découpé en parties envoyées séparément :
// un PUT unique est refusé par Vercel Blob pour les très gros fichiers, et le
// multipart permet aussi de relancer une partie en cas de coupure réseau.
const MULTIPART_THRESHOLD = 20 * 1024 * 1024;

/**
 * Téléverse un livre directement du navigateur vers Vercel Blob (le fichier ne
 * transite jamais par une fonction serverless, limitée à ~4,5 Mo par requête)
 * en accès privé (store privé : le serveur relit le fichier avec son token)
 * et renvoie son URL, à transmettre ensuite à analyze-book / ingest-pdf.
 * Les erreurs du SDK Blob sont traduites en messages lisibles.
 */
export async function uploadBookFile(file: File): Promise<string> {
  try {
    const blob = await upload(file.name, file, {
      access: 'private',
      handleUploadUrl: '/api/admin/blob-upload',
      multipart: file.size > MULTIPART_THRESHOLD,
    });
    return blob.url;
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (/retrieve the client token/i.test(message)) {
      throw new Error(await diagnoseTokenRoute(message));
    }
    throw new Error(describeBlobError(err, file));
  }
}

// Le SDK ne relaie pas l'erreur renvoyée par /api/admin/blob-upload : on
// interroge sa variante GET pour connaître la vraie cause (token absent,
// session expirée…).
async function diagnoseTokenRoute(fallback: string): Promise<string> {
  try {
    const res = await fetch('/api/admin/blob-upload');
    const data = (await res.json()) as { error?: string };
    if (!res.ok && data.error) return data.error;
  } catch {
    // diagnostic best-effort : on retombe sur le message d'origine
  }
  return `Échec du téléversement : ${fallback}`;
}

export function describeBlobError(err: unknown, file: { size: number }): string {
  const message = err instanceof Error ? err.message : String(err);
  const sizeMb = (file.size / 1024 / 1024).toFixed(1);
  if (/too large|cannot be greater than|exceeded the maximum/i.test(message)) {
    return `Fichier trop volumineux pour le stockage (${sizeMb} Mo). Détail : ${message}`;
  }
  if (/read-write token|blob credentials|BLOB_READ_WRITE_TOKEN/i.test(message)) {
    return "Stockage de fichiers non configuré sur le serveur : créez un Blob store dans l'onglet Storage du projet Vercel, reliez-le au projet puis redéployez.";
  }
  if (/private/i.test(message) && /public/i.test(message)) {
    return "Le Blob store Vercel est en accès public alors que l'application envoie les livres en accès privé : utilisez un store privé.";
  }
  if (/store.*(not found|suspended)/i.test(message)) {
    return `Blob store Vercel introuvable ou suspendu (quota dépassé ?). Détail : ${message}`;
  }
  return `Échec du téléversement (${sizeMb} Mo) : ${message}`;
}
