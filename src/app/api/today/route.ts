import { NextResponse } from 'next/server';
import { ensureUserProfile, getSessionContext } from '@/lib/serverAuth';
import { errorResponse } from '@/lib/http';
import { getToday } from '@/lib/learn';

/** Tableau de bord du jour : prochaine leçon, série, activité de la semaine. */
export async function GET() {
  try {
    const { userId } = await getSessionContext();
    await ensureUserProfile(userId);
    return NextResponse.json(await getToday(userId));
  } catch (err) {
    return errorResponse(err);
  }
}
