import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, ownerVisibilityWhere } from '@/lib/serverAuth';

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const visibility = ownerVisibilityWhere(userId);

    const domains = await prisma.domain.findMany({
      where: { isActive: true, ...visibility },
      orderBy: { order: 'asc' },
      include: {
        topics: {
          where: visibility,
          include: {
            userProgresses: {
              where: { userId },
            },
          },
        },
        placementResults: {
          where: { userId },
        },
      },
    });

    const user = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { currentActiveDomainId: true, currentActiveTopicId: true },
    });

    return NextResponse.json({
      domains,
      activeLock: {
        domainId: user?.currentActiveDomainId || null,
        topicId: user?.currentActiveTopicId || null,
      },
    });
  } catch (error) {
    console.error('Error fetching domains:', error);
    return NextResponse.json({ error: 'Failed to fetch domains' }, { status: 500 });
  }
}
