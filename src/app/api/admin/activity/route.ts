import { NextResponse } from 'next/server';
import { getActivity, requireAdmin } from '@/lib/admin';
import { errorResponse } from '@/lib/http';

/** Derniers événements de tous les profils. */
export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ activity: await getActivity() });
  } catch (err) {
    return errorResponse(err, 'Échec du chargement de l’activité.');
  }
}
