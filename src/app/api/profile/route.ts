import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureUserProfile, getCurrentUserId } from '@/lib/serverAuth';

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const user = await ensureUserProfile(userId);

    const completedSessionsCount = await prisma.userSession.count({
      where: { userId, completed: true },
    });

    return NextResponse.json({ ...user, completedSessionsCount });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await getCurrentUserId();
    await ensureUserProfile(userId);
    const body = await request.json();
    const { name, sessionMode, morningTime, eveningTime, singleSessionTime, accumulationReminder } = body;

    const updatedUser = await prisma.userProfile.update({
      where: { id: userId },
      data: {
        name,
        sessionMode,
        morningTime,
        eveningTime,
        singleSessionTime,
        ...(accumulationReminder !== undefined
          ? { notificationSettings: { update: { accumulationReminder } } }
          : {}),
      },
      include: {
        notificationSettings: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
  }
}
