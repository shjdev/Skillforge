import { AppError } from '@/lib/app-error';
import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/serverAuth';
import { errorResponse, personalKeyFrom } from '@/lib/http';
import { resolveApiKey } from '@/lib/import/gemini';
import { runStep, serializeJob } from '@/lib/import/service';

// Un jour de cours (2 leçons + quiz) par appel.
export const maxDuration = 300;

export async function POST(request: Request, ctx: RouteContext<'/api/imports/[id]/step'>) {
  try {
    const { id } = await ctx.params;
    const { userId } = await getSessionContext();
    const key = resolveApiKey(personalKeyFrom(request));
    if (!key.apiKey) throw new AppError('Aucune clé IA disponible.', 503);
    return NextResponse.json({ job: serializeJob(await runStep(id, userId, { apiKey: key.apiKey, personal: key.personal })) });
  } catch (err) {
    return errorResponse(err);
  }
}
