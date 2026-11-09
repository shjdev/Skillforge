import { prisma } from '@/lib/prisma';
import { listBooks } from '@/lib/library';

export const STATS_DAYS = 30;

/** Clé AAAA-MM-JJ en heure locale du serveur. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Répartit des leçons faites sur les `days` derniers jours (le plus ancien en premier). */
export function bucketByDay(sessions: { completedAt: Date | null; durationSeconds: number }[], days: number, now = new Date()) {
  const buckets = new Map<string, { date: string; lessons: number; minutes: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(dayKey(d), { date: dayKey(d), lessons: 0, minutes: 0 });
  }
  for (const s of sessions) {
    if (!s.completedAt) continue;
    const b = buckets.get(dayKey(s.completedAt));
    if (!b) continue;
    b.lessons += 1;
    b.minutes += Math.round(s.durationSeconds / 60);
  }
  return [...buckets.values()];
}

export async function getStats(userId: string) {
  const since = new Date();
  since.setDate(since.getDate() - (STATS_DAYS - 1));
  since.setHours(0, 0, 0, 0);

  const [user, totals, recent, passed, library] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: userId }, select: { totalXp: true, currentStreak: true } }),
    prisma.userSession.aggregate({ where: { userId, completed: true }, _count: true, _sum: { durationSeconds: true } }),
    prisma.userSession.findMany({
      where: { userId, completed: true, completedAt: { gte: since } },
      select: { completedAt: true, durationSeconds: true },
    }),
    prisma.quizAttempt.findMany({ where: { userId, passed: true }, distinct: ['quizId'], select: { quizId: true } }),
    listBooks(userId),
  ]);

  return {
    totals: {
      lessons: totals._count,
      minutes: Math.round((totals._sum.durationSeconds ?? 0) / 60),
      topicsValidated: passed.length,
      books: library.books.length,
      points: user?.totalXp ?? 0,
    },
    daily: bucketByDay(recent, STATS_DAYS),
    books: library.books.map((b) => ({ id: b.id, title: b.title, doneLessons: b.doneLessons, totalLessons: b.totalLessons })),
  };
}

export type StatsView = Awaited<ReturnType<typeof getStats>>;
