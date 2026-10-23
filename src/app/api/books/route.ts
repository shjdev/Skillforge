import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, ownerVisibilityWhere } from '@/lib/serverAuth';

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const books = await prisma.bookReference.findMany({
      where: ownerVisibilityWhere(userId),
      orderBy: { addedAt: 'desc' },
      include: {
        lessons: {
          include: { topic: { include: { domain: true } } },
        },
      },
    });

    const result = books.map((b) => {
      const domainNames = Array.from(
        new Set(b.lessons.map((l) => l.topic.domain.name))
      );
      const topicNames = Array.from(
        new Set(b.lessons.map((l) => `${l.topic.domain.name} / ${l.topic.name}`))
      );
      return {
        id: b.id,
        title: b.title,
        author: b.author,
        domain: domainNames.join(', ') || '—',
        topics: topicNames,
        lessonsCount: b.lessons.length,
        addedAt: b.addedAt,
        isOwn: b.ownerId === userId,
      };
    });

    return NextResponse.json({ books: result });
  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json({ error: 'Échec du chargement de la bibliothèque' }, { status: 500 });
  }
}
