import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/app-error';
import { getSessionContext } from '@/lib/serverAuth';
import { errorResponse } from '@/lib/http';
import { submitQuiz } from '@/lib/learn';

const bodySchema = z.object({ answers: z.record(z.string(), z.string().max(500)) });

/** Corrige le quiz et renvoie la correction détaillée. */
export async function POST(request: Request, ctx: RouteContext<'/api/quiz/[quizId]/submit'>) {
  try {
    const { quizId } = await ctx.params;
    const { userId } = await getSessionContext();
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new AppError('Réponses invalides.');
    return NextResponse.json(await submitQuiz(userId, quizId, parsed.data.answers));
  } catch (err) {
    return errorResponse(err);
  }
}
