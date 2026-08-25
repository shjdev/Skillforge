import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [domains, books, quizzes] = await Promise.all([
      prisma.domain.findMany({
        orderBy: { order: 'asc' },
        include: {
          topics: {
            orderBy: { name: 'asc' },
            include: {
              lessons: {
                orderBy: [{ dayNumber: 'asc' }, { sessionType: 'asc' }],
                include: { bookReference: { select: { id: true, title: true, author: true } } },
              },
            },
          },
        },
      }),
      prisma.bookReference.findMany({ include: { _count: { select: { lessons: true } } } }),
      prisma.quiz.findMany({ include: { questions: true } }),
    ]);

    const catalogue = {
      exportedAt: new Date().toISOString(),
      app: 'SkillForge',
      domains,
      books: books.map((b) => ({ ...b, lessonCount: b._count.lessons })),
      quizzes,
    };

    return new NextResponse(JSON.stringify(catalogue, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="skillforge-catalogue-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting catalogue:', error);
    return NextResponse.json({ error: "Échec de l'export du catalogue" }, { status: 500 });
  }
}
