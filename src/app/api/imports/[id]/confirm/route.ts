import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionContext } from '@/lib/serverAuth';
import { errorResponse } from '@/lib/http';
import { ImportError, confirmImport, serializeJob } from '@/lib/import/service';

const bodySchema = z.object({
  title: z.string().max(200).optional(),
  author: z.string().max(160).optional(),
  category: z.string().max(60).optional(),
  topicNames: z.array(z.string().max(120)).max(20).optional(),
});

/** Valide le plan proposé (avec les corrections de l'utilisateur) et lance la génération. */
export async function POST(request: Request, ctx: RouteContext<'/api/imports/[id]/confirm'>) {
  try {
    const { id } = await ctx.params;
    const { userId } = await getSessionContext();
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) throw new ImportError('Champs invalides.');
    return NextResponse.json({ job: serializeJob(await confirmImport(id, userId, parsed.data)) });
  } catch (err) {
    return errorResponse(err);
  }
}
