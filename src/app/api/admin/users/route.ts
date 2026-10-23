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

    const [user, completedSessionsCount, allUsers] = await Promise.all([
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
    ]);

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    return NextResponse.json({ user, completedSessionsCount, users: allUsers });
  } catch (error) {
    console.error('Error fetching admin user overview:', error);
    return NextResponse.json({ error: 'Échec du chargement du profil' }, { status: 500 });
  }
}
