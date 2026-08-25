import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_USER_ID, XP_PER_LESSON } from '@/lib/learning';

export async function GET() {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);

    const [sessions, user] = await Promise.all([
      prisma.userSession.findMany({
        where: { userId: DEFAULT_USER_ID, completed: true, scheduledAt: { gte: since } },
        select: { scheduledAt: true, durationSeconds: true, sessionType: true },
      }),
      prisma.userProfile.findUnique({ where: { id: DEFAULT_USER_ID } }),
    ]);

    const byDay = new Map<string, { date: string; label: string; sessions: number; minutes: number; points: number }>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      byDay.set(key, {
        date: key,
        label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        sessions: 0,
        minutes: 0,
        points: 0,
      });
    }

    let periodMinutes = 0;
    let periodPoints = 0;
    let periodSessions = 0;
    for (const s of sessions) {
      const d = new Date(s.scheduledAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const day = byDay.get(key);
      if (!day) continue;
      day.sessions += 1;
      day.points += XP_PER_LESSON;
      const mins = Math.round(s.durationSeconds / 60) || 30;
      day.minutes += mins;
      periodMinutes += mins;
      periodPoints += XP_PER_LESSON;
      periodSessions += 1;
    }

    return NextResponse.json({
      days: Array.from(byDay.values()),
      totals: {
        periodSessions,
        periodMinutes,
        periodPoints,
        totalXp: user?.totalXp ?? 0,
        currentStreak: user?.currentStreak ?? 0,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Échec du chargement des statistiques' }, { status: 500 });
  }
}
