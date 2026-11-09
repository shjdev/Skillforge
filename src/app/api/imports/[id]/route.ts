import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/serverAuth';
import { errorResponse } from '@/lib/http';
import { cancelImport, getOwnJob, serializeJob } from '@/lib/import/service';

export async function GET(_request: Request, ctx: RouteContext<'/api/imports/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { userId } = await getSessionContext();
    return NextResponse.json({ job: serializeJob(await getOwnJob(id, userId)) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Annule l'import ; les leçons déjà générées restent dans la bibliothèque. */
export async function DELETE(_request: Request, ctx: RouteContext<'/api/imports/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { userId } = await getSessionContext();
    return NextResponse.json({ job: serializeJob(await cancelImport(id, userId)) });
  } catch (err) {
    return errorResponse(err);
  }
}
