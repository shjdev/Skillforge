/**
 * Destination après connexion : seulement un chemin de l'application.
 * Refuse les adresses externes (`https://…`, `//site`, `/\site`) qui
 * enverraient l'utilisateur ailleurs après qu'il a saisi son mot de passe.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}
