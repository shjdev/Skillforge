import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/serverAuth';
import { errorResponse } from '@/lib/http';
import { getRevision } from '@/lib/learn';

/** Leçons faites, avec recherche facultative (?q=). */
export async function GET(request: Request) {
  try {
    const { userId } = await getSessionContext();
    const q = new URL(request.url).searchParams.get('q') ?? undefined;
    return NextResponse.json(await getRevision(userId, q));
  } catch (err) {
    return errorResponse(err);
  }
}
