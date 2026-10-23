import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureUserProfile, getCurrentUserId } from '@/lib/serverAuth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedId = searchParams.get('userId');
    const activeId = await getCurrentUserId();
    const targetUserId = requestedId || activeId;

    await ensureUserProfile(targetUserId);

    const [user, completedSessionsCount, allUsers, credential] = await Promise.all([
      prisma.userProfile.findUnique({
        where: { id: targetUserId },
        include: {
          progresses: {
            include: { topic: { include: { domain: true } } },
          },
          quizAttempts: {
            include: { quiz: true },
            orderBy: { attemptedAt: 'desc' },
            take: 10,
          },
          placementResults: {
            include: { domain: true },
            orderBy: { takenAt: 'desc' },
          },
          notificationSettings: true,
        },
      }),
      prisma.userSession.count({
        where: { userId: targetUserId, completed: true },
      }),
      prisma.userProfile.findMany({
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          totalXp: true,
          currentStreak: true,
          currentActiveDomainId: true,
        },
      }),
      prisma.userCredential.findUnique({ where: { userId: targetUserId }, select: { userId: true } }),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    return NextResponse.json({
      user,
      completedSessionsCount,
      users: allUsers,
      hasPersonalPassword: !!credential,
    });
  } catch (error) {
    console.error('Error fetching admin user overview:', error);
    return NextResponse.json({ error: 'Échec du chargement du profil' }, { status: 500 });
  }
}

/**
 * Réinitialise le mot de passe personnel d'un testeur (oubli). À sa prochaine
 * connexion, il saisira le code d'invitation et choisira un nouveau mot de passe.
 * Body : { userId: string, action: 'reset-password' }
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const userId = typeof body?.userId === 'string' ? body.userId : '';
    if (!userId || body?.action !== 'reset-password') {
      return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
    }
    await prisma.userCredential.deleteMany({ where: { userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resetting personal password:', error);
    return NextResponse.json({ error: 'Échec de la réinitialisation du mot de passe' }, { status: 500 });
  }
}
