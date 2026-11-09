import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/serverAuth';
import { errorResponse } from '@/lib/http';
import { getQuiz } from '@/lib/learn';

/** Questions du quiz (sans les réponses). */
export async function GET(_request: Request, ctx: RouteContext<'/api/quiz/[quizId]'>) {
  try {
    const { quizId } = await ctx.params;
    const { userId } = await getSessionContext();
    return NextResponse.json({ quiz: await getQuiz(userId, quizId) });
  } catch (err) {
    return errorResponse(err);
  }
}
