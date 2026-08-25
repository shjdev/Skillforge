import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const books = await prisma.bookReference.findMany({
      include: {
        _count: { select: { lessons: true } },
      },
      orderBy: { addedAt: 'desc' },
    });
    const topics = await prisma.topic.findMany({
      select: {
        id: true,
        name: true,
        domain: { select: { name: true } },
        lessons: { select: { id: true, bookReferenceId: true } },
      },
    });
    const booksWithMeta = books.map((b) => {
      const linkedTopics = topics
        .filter((t) => t.lessons.some((l) => l.bookReferenceId === b.id))
        .map((t) => `${t.domain.name} / ${t.name}`);
      return {
        id: b.id,
        title: b.title,
        author: b.author,
        description: b.description,
        addedAt: b.addedAt,
        lessonsCount: b._count.lessons,
        topics: [...new Set(linkedTopics)],
      };
    });
    return NextResponse.json({ books: booksWithMeta });
  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json({ error: 'Échec du chargement de la bibliothèque' }, { status: 500 });
  }
}
