import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/serverAuth';
import { errorResponse } from '@/lib/http';
import { getTopicView } from '@/lib/learn';

/** Thème à apprendre : leçons dans l'ordre, avancement et quiz. Peut le rendre actif. */
export async function GET(_request: Request, ctx: RouteContext<'/api/topics/[slug]'>) {
  try {
    const { slug } = await ctx.params;
    const { userId } = await getSessionContext();
    return NextResponse.json(await getTopicView(userId, slug));
  } catch (err) {
    return errorResponse(err);
  }
}
