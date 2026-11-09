import { NextResponse } from 'next/server';
import { AiError } from '@/lib/import/gemini';
import { ImportError } from '@/lib/import/service';

/** Réponse JSON d'erreur : message lisible pour les erreurs connues, générique sinon. */
export function errorResponse(err: unknown, fallback = 'Une erreur est survenue.'): NextResponse {
  if (err instanceof ImportError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof AiError) return NextResponse.json({ error: err.message }, { status: 502 });
  console.error('[api]', err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** Clé Gemini personnelle envoyée par le navigateur (jamais stockée côté serveur). */
export function personalKeyFrom(request: Request): string | null {
  const key = request.headers.get('x-gemini-key')?.trim();
  if (!key) return null;
  if (key.length > 200 || !/^[\x21-\x7e]+$/.test(key)) throw new ImportError('Clé Gemini personnelle invalide.');
  return key;
}
