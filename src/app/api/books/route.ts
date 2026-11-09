import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/serverAuth';
import { errorResponse } from '@/lib/http';
import { listBooks } from '@/lib/library';

/** Livres de l'utilisateur, avec leur avancement et les catégories utilisées. */
export async function GET() {
  try {
    const { userId } = await getSessionContext();
    return NextResponse.json(await listBooks(userId));
  } catch (err) {
    return errorResponse(err);
  }
}
