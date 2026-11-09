import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/serverAuth';
import { errorResponse } from '@/lib/http';
import { completeLesson } from '@/lib/learn';

/** Marque la leçon comme faite (points, série, avancement). */
export async function POST(_request: Request, ctx: RouteContext<'/api/lessons/[id]/complete'>) {
  try {
    const { id } = await ctx.params;
    const { userId } = await getSessionContext();
    return NextResponse.json(await completeLesson(userId, id));
  } catch (err) {
    return errorResponse(err);
  }
}
