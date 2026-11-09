'use client';

import { upload } from '@vercel/blob/client';
import { parseJsonResponse } from '@/lib/errors';

// Au-delà de ce seuil, le fichier est envoyé en plusieurs parties : un PUT
// unique est refusé pour les très gros fichiers, et une partie coupée se relance.
const MULTIPART_THRESHOLD = 20 * 1024 * 1024;

export type UploadMode = 'blob' | 'direct';

/** Clé Gemini personnelle gardée dans ce navigateur uniquement. */
export const PERSONAL_KEY_STORAGE = 'sf-gemini-key';

export function readPersonalKey(): string | null {
  try {
    return localStorage.getItem(PERSONAL_KEY_STORAGE)?.trim() || null;
  } catch {
    return null;
  }
}

/** En-têtes à joindre aux appels d'import (clé personnelle si présente). */
export function importHeaders(): Record<string, string> {
  const key = readPersonalKey();
  return key ? { 'x-gemini-key': key } : {};
}

export async function getUploadMode(): Promise<{ mode: UploadMode; maxBytes: number }> {
  return parseJsonResponse(await fetch('/api/uploads'));
}

/**
 * Lance l'import d'un fichier. En mode « blob », le navigateur téléverse
 * d'abord le fichier vers Vercel Blob (dans le dossier de l'utilisateur), puis
 * transmet son URL ; en mode « direct », le fichier part dans la requête.
 */
export async function startImport<T>(params: {
  file: File;
  userId: string;
  mode: UploadMode;
  onUploadProgress?: (pct: number) => void;
}): Promise<T> {
  const { file, userId, mode, onUploadProgress } = params;
  if (mode === 'direct') {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/imports', { method: 'POST', body: form, headers: importHeaders() });
    return parseJsonResponse<T>(res, "Impossible de lancer l'import.");
  }

  let url: string;
  try {
    const blob = await upload(`imports/${userId}/${safeName(file.name)}`, file, {
      access: 'private',
      handleUploadUrl: '/api/uploads',
      multipart: file.size > MULTIPART_THRESHOLD,
      onUploadProgress: (e) => onUploadProgress?.(Math.round(e.percentage)),
    });
    url = blob.url;
  } catch (err) {
    throw new Error(describeBlobError(err, file));
  }

  const res = await fetch('/api/imports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...importHeaders() },
    body: JSON.stringify({ fileUrl: url, fileName: file.name }),
  });
  return parseJsonResponse<T>(res, "Impossible de lancer l'import.");
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').slice(-120) || 'document';
}

export function describeBlobError(err: unknown, file: { size: number }): string {
  const message = err instanceof Error ? err.message : String(err);
  const sizeMb = (file.size / 1024 / 1024).toFixed(1);
  if (/too large|cannot be greater than|exceeded the maximum/i.test(message)) {
    return `Fichier trop volumineux pour le stockage (${sizeMb} Mo). Détail : ${message}`;
  }
  if (/content type|not allowed/i.test(message)) {
    return 'Format non pris en charge : importez un fichier PDF, TXT ou Markdown.';
  }
  if (/read-write token|blob credentials|BLOB_READ_WRITE_TOKEN/i.test(message)) {
    return "Stockage de fichiers non configuré sur le serveur : créez un Blob store dans l'onglet Storage du projet Vercel, reliez-le au projet puis redéployez.";
  }
  if (/retrieve the client token/i.test(message)) {
    return 'Téléversement refusé par le serveur (session expirée ?). Rechargez la page et réessayez.';
  }
  if (/store.*(not found|suspended)/i.test(message)) {
    return `Blob store Vercel introuvable ou suspendu (quota dépassé ?). Détail : ${message}`;
  }
  return `Échec du téléversement (${sizeMb} Mo) : ${message}`;
}
