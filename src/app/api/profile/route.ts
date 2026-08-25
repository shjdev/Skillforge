import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    let user = await prisma.userProfile.findUnique({
      where: { id: 'default-user' },
      include: {
        notificationSettings: true,
      },
    });

    if (!user) {
      user = await prisma.userProfile.create({
        data: {
          id: 'default-user',
          name: 'Apprenant SkillForge',
          sessionMode: 'TWO_SESSIONS',
          morningTime: '07:30',
          eveningTime: '20:00',
          notificationSettings: {
            create: {
              desktopEnabled: true,
              soundEnabled: true,
              morningReminderMins: 5,
              eveningReminderMins: 5,
              accumulationReminder: true,
              streakReminder: true,
            },
          },
        },
        include: {
          notificationSettings: true,
        },
      });
    }

    const completedSessionsCount = await prisma.userSession.count({
      where: { userId: 'default-user', completed: true },
    });

    return NextResponse.json({ ...user, completedSessionsCount });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { name, sessionMode, morningTime, eveningTime, singleSessionTime, accumulationReminder } = body;

    const updatedUser = await prisma.userProfile.update({
      where: { id: 'default-user' },
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
