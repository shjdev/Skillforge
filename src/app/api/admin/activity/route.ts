import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_USER_ID } from '@/lib/learning';

type ActivityItem = {
  at: Date;
  tag: 'SESSION' | 'QUIZ' | 'PLACEMENT' | 'IMPORT';
  text: string;
  val: string;
};

export async function GET() {
  try {
    const [sessions, quizAttempts, placements, books] = await Promise.all([
      prisma.userSession.findMany({
        where: { userId: DEFAULT_USER_ID, completed: true },
        include: { lesson: true },
        orderBy: { completedAt: 'desc' },
        take: 8,
      }),
      prisma.quizAttempt.findMany({
        where: { userId: DEFAULT_USER_ID },
        include: { quiz: true },
        orderBy: { attemptedAt: 'desc' },
        take: 8,
      }),
      prisma.placementResult.findMany({
        where: { userId: DEFAULT_USER_ID },
        include: { domain: true },
        orderBy: { takenAt: 'desc' },
        take: 8,
      }),
      prisma.bookReference.findMany({
        orderBy: { addedAt: 'desc' },
        take: 8,
        include: { lessons: true },
      }),
    ]);

    const items: ActivityItem[] = [
      ...sessions.map((s) => ({
        at: s.completedAt ?? s.scheduledAt,
        tag: 'SESSION' as const,
        text: `Leçon — ${s.lesson.title}`,
        val: '+50',
      })),
      ...quizAttempts.map((q) => ({
        at: q.attemptedAt,
        tag: 'QUIZ' as const,
        text: `${q.quiz.title} — ${q.passed ? 'validé' : 'échoué'}`,
        val: `${Math.round(q.percentage)}%`,
      })),
      ...placements.map((p) => ({
        at: p.takenAt,
        tag: 'PLACEMENT' as const,
        text: `${p.domain.name} — niveau ${p.assignedLevel} assigné`,
        val: `${p.score}%`,
      })),
      ...books
        .filter((b) => b.lessons.length > 0)
        .map((b) => ({
          at: b.addedAt,
          tag: 'IMPORT' as const,
          text: `${b.title} — ${b.lessons.length} leçon(s) générées`,
          val: 'PDF',
        })),
    ];

    items.sort((a, b) => b.at.getTime() - a.at.getTime());

    const activity = items.slice(0, 10).map((item) => ({
      time: item.at.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      tag: item.tag,
      text: item.text,
      val: item.val,
    }));

    return NextResponse.json({ activity });
  } catch (error) {
    console.error('Error fetching admin activity:', error);
    return NextResponse.json({ error: "Échec du chargement de l'activité" }, { status: 500 });
  }
}
