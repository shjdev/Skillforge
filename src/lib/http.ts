import { NextResponse } from 'next/server';
import { AiError } from '@/lib/import/gemini';
import { AppError } from '@/lib/app-error';

/** Réponse JSON d'erreur : message lisible pour les erreurs connues, générique sinon. */
export function errorResponse(err: unknown, fallback = 'Une erreur est survenue.'): NextResponse {
  if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof AiError) {
    return err.transient
      ? NextResponse.json({ error: err.message, retryable: true }, { status: 503, headers: { 'Retry-After': '20' } })
      : NextResponse.json({ error: err.message }, { status: 502 });
  }
  console.error('[api]', err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** Clé Gemini personnelle envoyée par le navigateur (jamais stockée côté serveur). */
export function personalKeyFrom(request: Request): string | null {
  const key = request.headers.get('x-gemini-key')?.trim();
  if (!key) return null;
  if (key.length > 200 || !/^[\x21-\x7e]+$/.test(key)) throw new AppError('Clé Gemini personnelle invalide.');
  return key;
}
