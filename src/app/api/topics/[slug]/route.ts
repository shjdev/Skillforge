import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_USER_ID, sortLessons } from '@/lib/learning';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const topic = await prisma.topic.findUnique({
      where: { slug },
      include: {
        domain: true,
        lessons: {
          include: { bookReference: true },
        },
        quizzes: {
          include: { questions: true },
        },
      },
    });

    if (!topic) {
      return NextResponse.json({ error: 'Sujet introuvable' }, { status: 404 });
    }

    let user = await prisma.userProfile.findUnique({ where: { id: DEFAULT_USER_ID } });
    if (!user) {
      user = await prisma.userProfile.create({ data: { id: DEFAULT_USER_ID } });
    }

    // Anti-dispersion lock: only one domain/topic may be active until completed.
    if (user.currentActiveDomainId && user.currentActiveDomainId !== topic.domainId) {
      const lockedDomain = await prisma.domain.findUnique({
        where: { id: user.currentActiveDomainId },
        select: { name: true, slug: true },
      });
      return NextResponse.json(
        {
          error: 'locked',
          message: 'Un autre domaine est déjà actif. Terminez-le avant d’en commencer un nouveau.',
          lockedDomain,
        },
        { status: 423 }
      );
    }
    if (user.currentActiveTopicId && user.currentActiveTopicId !== topic.id) {
      const lockedTopic = await prisma.topic.findUnique({
        where: { id: user.currentActiveTopicId },
        select: { name: true, slug: true },
      });
      return NextResponse.json(
        {
          error: 'locked',
          message: 'Un autre sujet de ce domaine est déjà actif. Terminez-le avant d’en commencer un nouveau.',
          lockedTopic,
        },
        { status: 423 }
      );
    }

    const progress = await prisma.userProgress.upsert({
      where: { userId_topicId: { userId: DEFAULT_USER_ID, topicId: topic.id } },
      update: {},
      create: { userId: DEFAULT_USER_ID, topicId: topic.id, currentWeek: 1, currentDay: 1 },
    });

    // Starting this topic for the first time: acquire the lock. A topic the
    // learner already finished (revisited from history) must never re-lock —
    // otherwise just viewing a completed topic would strand the lock forever.
    if (!user.currentActiveDomainId && progress.status !== 'COMPLETED') {
      user = await prisma.userProfile.update({
        where: { id: DEFAULT_USER_ID },
        data: { currentActiveDomainId: topic.domainId, currentActiveTopicId: topic.id },
      });
    }

    const completedSessions = await prisma.userSession.findMany({
      where: {
        userId: DEFAULT_USER_ID,
        completed: true,
        lesson: { topicId: topic.id },
      },
      select: { lessonId: true },
    });
    const completedLessonIds = new Set(completedSessions.map((s) => s.lessonId));

    const orderedLessons = sortLessons(topic.lessons);
    const nextLesson = orderedLessons.find((l) => !completedLessonIds.has(l.id)) || null;
    const allLessonsCompleted = orderedLessons.length > 0 && nextLesson === null;
    const completedCount = orderedLessons.filter((l) => completedLessonIds.has(l.id)).length;

    let quiz = null;
    let quizAttempt = null;
    let topicStatus = progress.status;
    if (allLessonsCompleted) {
      const weeklyQuiz = topic.quizzes.find((q) => q.quizType === 'WEEKLY');
      if (weeklyQuiz) {
        quiz = {
          id: weeklyQuiz.id,
          title: weeklyQuiz.title,
          passingScore: weeklyQuiz.passingScore,
          questions: weeklyQuiz.questions.map((q) => ({
            id: q.id,
            questionText: q.questionText,
            options: JSON.parse(q.options),
            points: q.points,
          })),
        };
        quizAttempt = await prisma.quizAttempt.findFirst({
          where: { userId: DEFAULT_USER_ID, quizId: weeklyQuiz.id },
          orderBy: { attemptedAt: 'desc' },
        });
      } else if (progress.status !== 'COMPLETED') {
        // No weekly quiz configured for this topic yet — don't strand the learner,
        // auto-complete and unlock so they can move on to another domain.
        await prisma.userProgress.update({
          where: { id: progress.id },
          data: { status: 'COMPLETED', completionPct: 100, completedAt: new Date() },
        });
        if (user.currentActiveTopicId === topic.id) {
          await prisma.userProfile.update({
            where: { id: DEFAULT_USER_ID },
            data: { currentActiveDomainId: null, currentActiveTopicId: null },
          });
        }
        topicStatus = 'COMPLETED';
      }
    }

    return NextResponse.json({
      topic: {
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        description: topic.description,
        estimatedWeeks: topic.estimatedWeeks,
        domain: {
          id: topic.domain.id,
          name: topic.domain.name,
          slug: topic.domain.slug,
          color: topic.domain.color,
        },
      },
      progress: {
        currentDay: progress.currentDay,
        currentWeek: progress.currentWeek,
        status: topicStatus,
        completionPct: orderedLessons.length ? Math.round((completedCount / orderedLessons.length) * 100) : 0,
        totalLessons: orderedLessons.length,
        completedLessons: completedCount,
      },
      activeLesson: nextLesson,
      allLessonsCompleted,
      quiz,
      quizAttempt,
    });
  } catch (error) {
    console.error('Error fetching topic:', error);
    return NextResponse.json({ error: 'Échec du chargement du sujet' }, { status: 500 });
  }
}
