import { describe, it, expect, afterEach, vi } from 'vitest';
import { toErrorMessage, parseJsonResponse } from './errors';

describe('toErrorMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports offline when navigator.onLine is false', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(toErrorMessage(new Error('irrelevant'))).toMatch(/hors ligne/i);
  });

  it('reports a connection issue for a bare TypeError (failed fetch)', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(toErrorMessage(new TypeError('Failed to fetch'))).toMatch(/connexion/i);
  });

  it('surfaces a real Error message when online', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(toErrorMessage(new Error('Seuil non atteint'))).toBe('Seuil non atteint');
  });

  it('falls back to a generic message for a non-Error throw', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(toErrorMessage('plain string')).toBe('Une erreur est survenue.');
  });

  it('accepts a custom fallback', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(toErrorMessage({}, 'Échec de la sauvegarde.')).toBe('Échec de la sauvegarde.');
  });
});

describe('parseJsonResponse', () => {
  it('returns the parsed body on a successful response', async () => {
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 });
    await expect(parseJsonResponse(res)).resolves.toEqual({ ok: true });
  });

  it('throws the server-provided error message on a non-ok JSON response', async () => {
    const res = new Response(JSON.stringify({ error: 'Titre requis.' }), { status: 400 });
    await expect(parseJsonResponse(res, 'Échec.')).rejects.toThrow('Titre requis.');
  });

  it('falls back to the given message on a non-ok JSON response with no error field', async () => {
    const res = new Response(JSON.stringify({}), { status: 500 });
    await expect(parseJsonResponse(res, 'Échec de la génération.')).rejects.toThrow('Échec de la génération.');
  });

  it('reports the file-too-large case for a 413 with a non-JSON body', async () => {
    const res = new Response('Request Entity Too Large', { status: 413 });
    await expect(parseJsonResponse(res)).rejects.toThrow(/volumineux/i);
  });

  it('reports an unexpected response for any other non-JSON body', async () => {
    const res = new Response('<html>502 Bad Gateway</html>', { status: 502 });
    await expect(parseJsonResponse(res, "Échec de l'analyse")).rejects.toThrow(/inattendue/i);
  });
});
