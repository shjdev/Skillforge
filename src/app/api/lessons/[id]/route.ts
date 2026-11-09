import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/serverAuth';
import { errorResponse } from '@/lib/http';
import { getLesson } from '@/lib/learn';

export async function GET(_request: Request, ctx: RouteContext<'/api/lessons/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { userId } = await getSessionContext();
    return NextResponse.json({ lesson: await getLesson(userId, id) });
  } catch (err) {
    return errorResponse(err);
  }
}
