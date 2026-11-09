import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/serverAuth';
import { errorResponse } from '@/lib/http';
import { getStats } from '@/lib/stats';

/** Totaux, activité des 30 derniers jours et avancement par livre. */
export async function GET() {
  try {
    const { userId } = await getSessionContext();
    return NextResponse.json(await getStats(userId));
  } catch (err) {
    return errorResponse(err);
  }
}
