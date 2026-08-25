import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_USER_ID } from '@/lib/learning';

export async function GET() {
  try {
    const user = await prisma.userProfile.findUnique({
      where: { id: DEFAULT_USER_ID },
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
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const completedSessionsCount = await prisma.userSession.count({
      where: { userId: DEFAULT_USER_ID, completed: true },
    });

    return NextResponse.json({ user, completedSessionsCount });
  } catch (error) {
    console.error('Error fetching admin user overview:', error);
    return NextResponse.json({ error: 'Échec du chargement du profil' }, { status: 500 });
  }
}
