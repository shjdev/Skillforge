import { NextResponse } from 'next/server';
import { ensureUserProfile, getSessionContext } from '@/lib/serverAuth';
import { isAuthEnabled } from '@/lib/authGate';

/**
 * Profil de la session courante, pour le shell de l'appli.
 * Réponse : { userId, name, isAdmin, authEnabled, totalXp, currentStreak }
 */
export async function GET() {
  try {
    const session = await getSessionContext();
    const user = await ensureUserProfile(session.userId);
    return NextResponse.json({
      userId: session.userId,
      name: user.name,
      isAdmin: session.isAdmin,
      authEnabled: isAuthEnabled(),
      totalXp: user.totalXp,
      currentStreak: user.currentStreak,
    });
  } catch (error) {
    console.error('Error loading current session:', error);
    return NextResponse.json({ error: 'Impossible de charger votre profil.' }, { status: 500 });
  }
}
