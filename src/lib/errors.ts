/**
 * Turns a caught error into a message worth showing the user. Distinguishes
 * "you're offline" / "the network request itself failed" from a proper
 * server-returned error, since a fetch() that never reaches the server
 * throws a plain TypeError with no useful message of its own.
 */
export function toErrorMessage(err: unknown, fallback = 'Une erreur est survenue.'): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return "Hors ligne — non enregistré. Réessayez une fois reconnecté.";
  }
  if (err instanceof TypeError) {
    return 'Connexion impossible — vérifiez votre réseau et réessayez.';
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/**
 * Parses a fetch Response as JSON, and throws a readable Error instead of
 * letting JSON.parse's own error leak through when the body isn't JSON —
 * which happens when a request is rejected by infrastructure before it ever
 * reaches our route handler (e.g. Vercel's plain-text "Request Entity Too
 * Large" for an oversized upload). Also throws on a non-ok response, using
 * the server's `error` field when present.
 */
export async function parseJsonResponse<T = unknown>(res: Response, fallbackError = 'Une erreur est survenue.'): Promise<T> {
  const raw = await res.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(
        res.status === 413
          ? 'Fichier trop volumineux pour le serveur (limite ~4 Mo par requête). Réessayez avec un PDF plus léger.'
          : `${fallbackError} (réponse serveur inattendue, code ${res.status}).`
      );
    }
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : fallbackError;
    throw new Error(message);
  }
  return data as T;
}
