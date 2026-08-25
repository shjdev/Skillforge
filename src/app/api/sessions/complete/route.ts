import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_USER_ID, XP_PER_LESSON, sortLessons, todayStr, yesterdayStr } from '@/lib/learning';

export async function POST(request: Request) {
  try {
    const { lessonId, alsoNext, notes } = await request.json();
    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId requis' }, { status: 400 });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { topic: { include: { lessons: true } } },
    });
    if (!lesson) {
      return NextResponse.json({ error: 'Leçon introuvable' }, { status: 404 });
    }

    const user = await prisma.userProfile.findUnique({ where: { id: DEFAULT_USER_ID } });
    if (!user || user.currentActiveTopicId !== lesson.topicId) {
      return NextResponse.json(
        { error: 'locked', message: 'Ce sujet n’est pas votre apprentissage actif.' },
        { status: 423 }
      );
    }

    // Séance de rattrapage : valide aussi la leçon suivante (cumul 2×30 min)
    // pour rattraper une session manquée la veille sans casser le rythme.
    const targets: { id: string; title: string; sessionType: string; durationMinutes: number }[] = [
      { id: lesson.id, title: lesson.title, sessionType: lesson.sessionType, durationMinutes: lesson.durationMinutes },
    ];
    let caughtUpTitle: string | null = null;
    if (alsoNext) {
      const completed = await prisma.userSession.findMany({
        where: { userId: DEFAULT_USER_ID, completed: true, lesson: { topicId: lesson.topicId } },
        select: { lessonId: true },
      });
      const completedIds = new Set(completed.map((s) => s.lessonId));
      const nextIncomplete = sortLessons(lesson.topic.lessons).find(
        (l) => !completedIds.has(l.id) && l.id !== lesson.id
      );
      if (nextIncomplete) {
        targets.push({
          id: nextIncomplete.id,
          title: nextIncomplete.title,
          sessionType: nextIncomplete.sessionType,
          durationMinutes: nextIncomplete.durationMinutes,
        });
        caughtUpTitle = nextIncomplete.title;
      }
    }

    let xpAwarded = 0;
    for (const target of targets) {
      const alreadyCompleted = await prisma.userSession.findFirst({
        where: { userId: DEFAULT_USER_ID, lessonId: target.id, completed: true },
      });
      if (alreadyCompleted) continue;

      await prisma.userSession.create({
        data: {
          userId: DEFAULT_USER_ID,
          lessonId: target.id,
          sessionType:
            target.id !== lesson.id || (target.sessionType !== 'MORNING' && target.sessionType !== 'EVENING')
              ? 'ACCUMULATED'
              : target.sessionType,
          scheduledAt: new Date(),
          startedAt: new Date(),
          completedAt: new Date(),
          durationSeconds: target.durationMinutes * 60,
          completed: true,
          notes:
            target.id !== lesson.id
              ? 'Séance de rattrapage (cumul)'
              : typeof notes === 'string' && notes.trim()
                ? notes.trim()
                : null,
        },
      });
      xpAwarded += XP_PER_LESSON;
    }

    if (xpAwarded > 0) {
      const today = todayStr();
      const yesterday = yesterdayStr();
      const newStreak =
        user.lastSessionDate === today
          ? user.currentStreak
          : user.lastSessionDate === yesterday
          ? user.currentStreak + 1
          : 1;

      await prisma.userProfile.update({
        where: { id: DEFAULT_USER_ID },
        data: {
          totalXp: user.totalXp + xpAwarded,
          currentStreak: newStreak,
          lastSessionDate: today,
        },
      });
    }

    const completedSessions = await prisma.userSession.findMany({
      where: { userId: DEFAULT_USER_ID, completed: true, lesson: { topicId: lesson.topicId } },
      select: { lessonId: true },
    });
    const completedLessonIds = new Set(completedSessions.map((s) => s.lessonId));
    const orderedLessons = sortLessons(lesson.topic.lessons);
    const nextLesson = orderedLessons.find((l) => !completedLessonIds.has(l.id)) || null;
    const allLessonsCompleted = nextLesson === null;
    const completedCount = orderedLessons.filter((l) => completedLessonIds.has(l.id)).length;

    const completionPct = orderedLessons.length
      ? Math.round((completedCount / orderedLessons.length) * 100)
      : 0;
    const currentDay = nextLesson ? nextLesson.dayNumber : lesson.dayNumber;

    const progress = await prisma.userProgress.upsert({
      where: { userId_topicId: { userId: DEFAULT_USER_ID, topicId: lesson.topicId } },
      update: { currentDay, completionPct },
      create: { userId: DEFAULT_USER_ID, topicId: lesson.topicId, currentDay, completionPct },
    });

    const updatedUser = await prisma.userProfile.findUnique({ where: { id: DEFAULT_USER_ID } });

    return NextResponse.json({
      success: true,
      xpAwarded,
      totalXp: updatedUser?.totalXp || 0,
      currentStreak: updatedUser?.currentStreak || 0,
      progress,
      allLessonsCompleted,
      caughtUpTitle,
    });
  } catch (error) {
    console.error('Error completing session:', error);
    return NextResponse.json({ error: 'Échec de la validation de la session' }, { status: 500 });
  }
}
