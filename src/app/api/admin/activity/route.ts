import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type ActivityItem = {
  at: Date;
  tag: 'SESSION' | 'QUIZ' | 'PLACEMENT' | 'IMPORT';
  text: string;
  val: string;
};

/**
 * Activité récente de la plateforme. Sans paramètre : tous les profils, chaque
 * ligne préfixée du nom du profil. Avec `?userId=` : ce profil uniquement.
 */
export async function GET(request: Request) {
  try {
    const targetUserId = new URL(request.url).searchParams.get('userId');
    const userWhere = targetUserId ? { userId: targetUserId } : {};

    const [sessions, quizAttempts, placements, books, profiles] = await Promise.all([
      prisma.userSession.findMany({
        where: { ...userWhere, completed: true },
        include: { lesson: true },
        orderBy: { completedAt: 'desc' },
        take: 8,
      }),
      prisma.quizAttempt.findMany({
        where: userWhere,
        include: { quiz: true },
        orderBy: { attemptedAt: 'desc' },
        take: 8,
      }),
      prisma.placementResult.findMany({
        where: userWhere,
        include: { domain: true },
        orderBy: { takenAt: 'desc' },
        take: 8,
      }),
      prisma.bookReference.findMany({
        where: targetUserId ? { ownerId: targetUserId } : undefined,
        orderBy: { addedAt: 'desc' },
        take: 8,
        include: { lessons: { select: { id: true } } },
      }),
      prisma.userProfile.findMany({ select: { id: true, name: true } }),
    ]);

    const names = new Map(profiles.map((p) => [p.id, p.name]));
    // En vue « tous profils », on indique à qui appartient chaque ligne.
    const who = (userId: string | null | undefined) => {
      if (targetUserId) return '';
      if (!userId) return 'Catalogue · ';
      return `${names.get(userId) ?? userId} · `;
    };

    const items: ActivityItem[] = [
      ...sessions.map((s) => ({
        at: s.completedAt ?? s.scheduledAt,
        tag: 'SESSION' as const,
        text: `${who(s.userId)}Leçon — ${s.lesson.title}`,
        val: '+50',
      })),
      ...quizAttempts.map((q) => ({
        at: q.attemptedAt,
        tag: 'QUIZ' as const,
        text: `${who(q.userId)}${q.quiz.title} — ${q.passed ? 'validé' : 'échoué'}`,
        val: `${Math.round(q.percentage)}%`,
      })),
      ...placements.map((p) => ({
        at: p.takenAt,
        tag: 'PLACEMENT' as const,
        text: `${who(p.userId)}${p.domain.name} — niveau ${p.assignedLevel} assigné`,
        val: `${p.score}%`,
      })),
      ...books
        .filter((b) => b.lessons.length > 0)
        .map((b) => ({
          at: b.addedAt,
          tag: 'IMPORT' as const,
          text: `${who(b.ownerId)}${b.title} — ${b.lessons.length} leçon(s) générées`,
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
