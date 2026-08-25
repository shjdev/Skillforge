import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const domains = await prisma.domain.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        topics: {
          include: {
            userProgresses: {
              where: { userId: 'default-user' },
            },
          },
        },
        placementResults: {
          where: { userId: 'default-user' },
        },
      },
    });

    const user = await prisma.userProfile.findUnique({
      where: { id: 'default-user' },
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
