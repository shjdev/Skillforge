import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_USER_ID } from '@/lib/learning';

export async function GET() {
  try {
    const sessions = await prisma.userSession.findMany({
      where: { userId: DEFAULT_USER_ID, completed: true },
      orderBy: { completedAt: 'desc' },
      take: 200,
      include: {
        lesson: {
          include: {
            topic: { select: { id: true, name: true, domain: { select: { id: true, name: true, color: true } } } },
            bookReference: { select: { title: true, author: true } },
          },
        },
      },
    });

    // Déduplication : une leçon peut avoir été validée plusieurs fois.
    const seen = new Set<string>();
    const lessons = [];
    for (const s of sessions) {
      if (seen.has(s.lessonId)) continue;
      seen.add(s.lessonId);
      let concepts: string[] = [];
      try {
        concepts = JSON.parse(s.lesson.keyConcepts || '[]');
      } catch {
        concepts = [];
      }
      lessons.push({
        lessonId: s.lesson.id,
        title: s.lesson.title,
        dayNumber: s.lesson.dayNumber,
        chapterCitation: s.lesson.chapterCitation,
        bookTitle: s.lesson.bookReference?.title || null,
        concepts,
        note: s.notes || null,
        topicName: s.lesson.topic.name,
        domainName: s.lesson.topic.domain.name,
        domainColor: s.lesson.topic.domain.color,
        completedAt: s.completedAt,
      });
    }

    return NextResponse.json({ lessons });
  } catch (error) {
    console.error('Error fetching revision data:', error);
    return NextResponse.json({ error: 'Échec du chargement des révisions' }, { status: 500 });
  }
}
