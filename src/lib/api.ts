import { parseJsonResponse } from './errors';

/**
 * Appel JSON côté client : lève une Error lisible (message du serveur) si la
 * réponse n'est pas ok, pour que react-query affiche l'erreur au lieu d'un
 * écran vide trompeur.
 */
export async function fetchJson<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  return parseJsonResponse<T>(res, 'Une erreur est survenue.');
}
