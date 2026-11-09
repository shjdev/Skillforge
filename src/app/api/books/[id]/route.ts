import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionContext } from '@/lib/serverAuth';
import { errorResponse } from '@/lib/http';
import { deleteBook, getBook, updateBook } from '@/lib/library';

const NOT_FOUND = { error: 'Livre introuvable.' };

export async function GET(_request: Request, ctx: RouteContext<'/api/books/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { userId } = await getSessionContext();
    const book = await getBook(userId, id);
    return book ? NextResponse.json({ book }) : NextResponse.json(NOT_FOUND, { status: 404 });
  } catch (err) {
    return errorResponse(err);
  }
}

const patchSchema = z.object({
  title: z.string().max(200).optional(),
  author: z.string().max(160).optional(),
  category: z.string().max(60).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<'/api/books/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { userId } = await getSessionContext();
    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Champs invalides.' }, { status: 400 });
    if (parsed.data.title !== undefined && !parsed.data.title.trim()) {
      return NextResponse.json({ error: 'Le titre est obligatoire.' }, { status: 400 });
    }
    if (!(await updateBook(userId, id, parsed.data))) return NextResponse.json(NOT_FOUND, { status: 404 });
    return NextResponse.json({ book: await getBook(userId, id) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Supprime le livre, ses thèmes, leçons, quiz et l'avancement associé. */
export async function DELETE(_request: Request, ctx: RouteContext<'/api/books/[id]'>) {
  try {
    const { id } = await ctx.params;
    const { userId } = await getSessionContext();
    if (!(await deleteBook(userId, id))) return NextResponse.json(NOT_FOUND, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
