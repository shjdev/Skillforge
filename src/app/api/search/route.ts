import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const lessons = await prisma.lesson.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { contentMd: { contains: q, mode: 'insensitive' } },
          { keyConcepts: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: {
        topic: { select: { slug: true, name: true, domain: { select: { slug: true, name: true } } } },
      },
      take: 20,
      orderBy: { dayNumber: 'asc' },
    });

    const results = lessons.map((l) => {
      // Extrait court centré sur l'occurrence si trouvée dans le contenu.
      let snippet = '';
      const idx = l.contentMd.toLowerCase().indexOf(q.toLowerCase());
      if (idx >= 0) {
        snippet = l.contentMd.slice(Math.max(0, idx - 60), idx + 90).replace(/\s+/g, ' ').trim();
      }
      let matchedConcept: string | null = null;
      try {
        const concepts: string[] = JSON.parse(l.keyConcepts || '[]');
        matchedConcept = concepts.find((c) => c.toLowerCase().includes(q.toLowerCase())) || null;
      } catch {
        matchedConcept = null;
      }
      return {
        lessonId: l.id,
        title: l.title,
        dayNumber: l.dayNumber,
        snippet,
        matchedConcept,
        topicName: l.topic.name,
        topicSlug: l.topic.slug,
        domainName: l.topic.domain.name,
        domainSlug: l.topic.domain.slug,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error searching:', error);
    return NextResponse.json({ error: 'Échec de la recherche' }, { status: 500 });
  }
}
