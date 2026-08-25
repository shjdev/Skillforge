import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const books = await prisma.bookReference.findMany({
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
      return {
        id: b.id,
        title: b.title,
        author: b.author,
        domain: domainNames.join(', ') || '—',
        lessonsCount: b.lessons.length,
      };
    });

    return NextResponse.json({ books: result });
  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json({ error: 'Échec du chargement de la bibliothèque' }, { status: 500 });
  }
}
