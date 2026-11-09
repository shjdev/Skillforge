// Apprentissage : un thème actif à la fois, leçons dans l'ordre, quiz de
// validation à la fin. Toutes les fonctions vérifient le propriétaire.

import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/app-error';
import { XP_PER_LESSON, XP_PER_QUIZ_PASS, nextStreak, scoreQuiz, sortLessons, todayStr, yesterdayStr } from '@/lib/learning';

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);

/** Thème actif réel (null si l'ancien a été supprimé). */
async function activeTopicOf(userId: string) {
  const user = await prisma.userProfile.findUnique({ where: { id: userId }, select: { currentActiveTopicId: true } });
  if (!user?.currentActiveTopicId) return null;
  const topic = await prisma.topic.findFirst({
    where: { id: user.currentActiveTopicId, ownerId: userId },
    select: { id: true, name: true, slug: true, book: { select: { title: true } } },
  });
  if (!topic) await prisma.userProfile.update({ where: { id: userId }, data: { currentActiveTopicId: null } });
  return topic;
}

async function completedLessonIds(userId: string, topicId: string): Promise<Set<string>> {
  const sessions = await prisma.userSession.findMany({
    where: { userId, completed: true, lesson: { topicId } },
    select: { lessonId: true },
  });
  return new Set(sessions.map((s) => s.lessonId));
}

// ─── Page d'un thème ────────────────────────────────────────────────────────

/**
 * Ouvre un thème. S'il n'est pas validé et qu'aucun autre thème n'est actif,
 * il devient le thème actif ; si un autre l'est, renvoie `locked`.
 */
export async function getTopicView(userId: string, slug: string) {
  const topic = await prisma.topic.findUnique({
    where: { ownerId_slug: { ownerId: userId, slug } },
    include: {
      book: { select: { id: true, title: true, author: true } },
      lessons: {
        select: { id: true, title: true, dayNumber: true, sessionType: true, durationMinutes: true, difficultyLevel: true },
      },
      quiz: { select: { id: true, passingScore: true, _count: { select: { questions: true } } } },
      userProgresses: { where: { userId } },
    },
  });
  if (!topic) throw new AppError('Thème introuvable.', 404);
  if (topic.status !== 'READY') throw new AppError('Ce thème est encore en préparation.', 409);

  let progress = topic.userProgresses[0] ?? null;
  const completed = progress?.status === 'COMPLETED';
  const active = await activeTopicOf(userId);

  if (!completed && active && active.id !== topic.id) {
    return {
      locked: true as const,
      topic: { name: topic.name, book: topic.book },
      activeTopic: { name: active.name, slug: active.slug, bookTitle: active.book.title },
    };
  }
  if (!completed && !active) {
    await prisma.userProfile.update({ where: { id: userId }, data: { currentActiveTopicId: topic.id } });
  }
  if (!progress) {
    progress = await prisma.userProgress.upsert({
      where: { userId_topicId: { userId, topicId: topic.id } },
      update: {},
      create: { userId, topicId: topic.id },
    });
  }

  const done = await completedLessonIds(userId, topic.id);
  const lessons = sortLessons(topic.lessons).map((l) => ({ ...l, done: done.has(l.id) }));
  const allDone = lessons.length > 0 && lessons.every((l) => l.done);

  // Thème sans question de quiz : il est validé dès que toutes les leçons sont faites.
  if (allDone && progress.status !== 'COMPLETED' && !topic.quiz?._count.questions) {
    progress = await prisma.userProgress.update({
      where: { id: progress.id },
      data: { status: 'COMPLETED', completionPct: 100, completedAt: new Date() },
    });
    await prisma.userProfile.updateMany({ where: { id: userId, currentActiveTopicId: topic.id }, data: { currentActiveTopicId: null } });
  }
  const lastAttempt = topic.quiz
    ? await prisma.quizAttempt.findFirst({
        where: { userId, quizId: topic.quiz.id },
        orderBy: { attemptedAt: 'desc' },
        select: { percentage: true, passed: true, attemptedAt: true },
      })
    : null;

  return {
    locked: false as const,
    topic: {
      id: topic.id,
      slug: topic.slug,
      name: topic.name,
      description: topic.description,
      book: topic.book,
      status: progress.status as 'IN_PROGRESS' | 'COMPLETED',
    },
    lessons,
    nextLessonId: lessons.find((l) => !l.done)?.id ?? null,
    quiz: topic.quiz && {
      id: topic.quiz.id,
      passingScore: topic.quiz.passingScore,
      questionCount: topic.quiz._count.questions,
      available: allDone && topic.quiz._count.questions > 0,
      lastAttempt: lastAttempt && { ...lastAttempt, attemptedAt: lastAttempt.attemptedAt.toISOString() },
    },
  };
}

export type TopicView = Awaited<ReturnType<typeof getTopicView>>;

// ─── Leçons ─────────────────────────────────────────────────────────────────

export async function getLesson(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, topic: { ownerId: userId } },
    select: {
      id: true,
      title: true,
      contentMd: true,
      dayNumber: true,
      sessionType: true,
      difficultyLevel: true,
      durationMinutes: true,
      keyConcepts: true,
      chapterCitation: true,
      topicId: true,
    },
  });
  if (!lesson) throw new AppError('Leçon introuvable.', 404);
  return { ...lesson, keyConcepts: strings(lesson.keyConcepts) };
}

/**
 * Marque une leçon comme faite : points, série de jours et avancement.
 * Réservé au thème actif ; refaire une leçon déjà faite ne rapporte rien.
 */
export async function completeLesson(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, topic: { ownerId: userId } },
    select: { id: true, topicId: true, sessionType: true, durationMinutes: true, dayNumber: true },
  });
  if (!lesson) throw new AppError('Leçon introuvable.', 404);
  const active = await activeTopicOf(userId);
  if (active?.id !== lesson.topicId) throw new AppError("Ce thème n'est pas votre thème en cours.", 409);

  const xpAwarded = await prisma.$transaction(async (tx) => {
    const already = await tx.userSession.findFirst({ where: { userId, lessonId, completed: true }, select: { id: true } });
    if (already) return 0;
    const now = new Date();
    await tx.userSession.create({
      data: {
        userId,
        lessonId,
        sessionType: lesson.sessionType === 'EVENING' ? 'EVENING' : 'MORNING',
        scheduledAt: now,
        completedAt: now,
        durationSeconds: lesson.durationMinutes * 60,
        completed: true,
      },
    });
    const user = await tx.userProfile.findUniqueOrThrow({ where: { id: userId } });
    await tx.userProfile.update({
      where: { id: userId },
      data: {
        totalXp: { increment: XP_PER_LESSON },
        currentStreak: nextStreak(user.lastSessionDate, user.currentStreak),
        lastSessionDate: todayStr(),
      },
    });
    return XP_PER_LESSON;
  });

  const [total, done] = await Promise.all([
    prisma.lesson.findMany({ where: { topicId: lesson.topicId }, select: { id: true, dayNumber: true, sessionType: true } }),
    completedLessonIds(userId, lesson.topicId),
  ]);
  const next = sortLessons(total).find((l) => !done.has(l.id));
  await prisma.userProgress.upsert({
    where: { userId_topicId: { userId, topicId: lesson.topicId } },
    update: { currentDay: next?.dayNumber ?? lesson.dayNumber, completionPct: Math.round((done.size / total.length) * 100) },
    create: { userId, topicId: lesson.topicId, currentDay: next?.dayNumber ?? lesson.dayNumber },
  });

  return { xpAwarded, nextLessonId: next?.id ?? null, allDone: !next };
}

// ─── Quiz ───────────────────────────────────────────────────────────────────

/** Questions du quiz, sans les réponses. Disponible une fois toutes les leçons faites. */
export async function getQuiz(userId: string, quizId: string) {
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, topic: { ownerId: userId } },
    include: { questions: { orderBy: [{ dayNumber: 'asc' }, { id: 'asc' }] }, topic: { select: { id: true, name: true, slug: true } } },
  });
  if (!quiz) throw new AppError('Quiz introuvable.', 404);
  await assertQuizUnlocked(userId, quiz.topic.id);
  return {
    id: quiz.id,
    title: quiz.title,
    passingScore: quiz.passingScore,
    topic: quiz.topic,
    questions: quiz.questions.map((q) => ({ id: q.id, questionText: q.questionText, options: strings(q.options), dayNumber: q.dayNumber })),
  };
}

async function assertQuizUnlocked(userId: string, topicId: string) {
  const [lessons, done] = await Promise.all([prisma.lesson.count({ where: { topicId } }), completedLessonIds(userId, topicId)]);
  if (lessons === 0 || done.size < lessons) {
    throw new AppError('Terminez toutes les leçons du thème pour passer le quiz.', 409);
  }
}

/**
 * Corrige le quiz. Réussi : le thème est validé, il libère la place de thème
 * actif et rapporte des points (une seule fois).
 */
export async function submitQuiz(userId: string, quizId: string, answers: Record<string, unknown>) {
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, topic: { ownerId: userId } },
    include: { questions: true },
  });
  if (!quiz) throw new AppError('Quiz introuvable.', 404);
  await assertQuizUnlocked(userId, quiz.topicId);

  const result = scoreQuiz(quiz.questions, answers, quiz.passingScore);
  const alreadyPassed = await prisma.quizAttempt.count({ where: { userId, quizId, passed: true } });

  await prisma.$transaction(async (tx) => {
    await tx.quizAttempt.create({
      data: {
        userId,
        quizId,
        score: result.score,
        maxScore: result.maxScore,
        percentage: result.percentage,
        passed: result.passed,
        answers: answers as object,
      },
    });
    if (!result.passed) return;
    await tx.userProgress.upsert({
      where: { userId_topicId: { userId, topicId: quiz.topicId } },
      update: { status: 'COMPLETED', completionPct: 100, completedAt: new Date() },
      create: { userId, topicId: quiz.topicId, status: 'COMPLETED', completionPct: 100, completedAt: new Date() },
    });
    await tx.userProfile.updateMany({ where: { id: userId, currentActiveTopicId: quiz.topicId }, data: { currentActiveTopicId: null } });
    if (!alreadyPassed) {
      await tx.userProfile.update({ where: { id: userId }, data: { totalXp: { increment: XP_PER_QUIZ_PASS } } });
    }
  });

  return {
    ...result,
    passingScore: quiz.passingScore,
    xpAwarded: result.passed && !alreadyPassed ? XP_PER_QUIZ_PASS : 0,
    corrections: quiz.questions.map((q) => ({
      id: q.id,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      correct: result.correct[q.id],
    })),
  };
}

export type QuizResult = Awaited<ReturnType<typeof submitQuiz>>;

// ─── Aujourd'hui ────────────────────────────────────────────────────────────

/** Début du jour local (serveur) il y a `daysAgo` jours. */
function startOfDay(daysAgo = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

/**
 * Ce que l'apprenant doit faire maintenant : la prochaine leçon du thème
 * actif, sinon des thèmes à commencer, sinon importer un livre.
 */
export async function getToday(userId: string) {
  const [user, active, weekSessions, booksCount, imports] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: userId }, select: { name: true, totalXp: true, currentStreak: true, lastSessionDate: true } }),
    activeTopicOf(userId),
    prisma.userSession.findMany({
      where: { userId, completed: true, completedAt: { gte: startOfDay(6) } },
      select: { completedAt: true },
    }),
    prisma.book.count({ where: { ownerId: userId } }),
    prisma.importJob.findMany({
      where: { ownerId: userId, status: { in: ['REVIEW', 'GENERATING'] } },
      select: { id: true, status: true, fileName: true, cursor: true, queue: true, book: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Leçons faites sur les 7 derniers jours (du plus ancien à aujourd'hui).
  const week = Array.from({ length: 7 }, (_, i) => {
    const from = startOfDay(6 - i);
    const to = startOfDay(5 - i);
    return {
      date: from.toISOString(),
      lessons: weekSessions.filter((s) => s.completedAt && s.completedAt >= from && s.completedAt < to).length,
    };
  });

  let current = null;
  if (active) {
    const [lessons, done, quiz] = await Promise.all([
      prisma.lesson.findMany({
        where: { topicId: active.id },
        select: { id: true, title: true, dayNumber: true, sessionType: true, durationMinutes: true },
      }),
      completedLessonIds(userId, active.id),
      prisma.quiz.findUnique({ where: { topicId: active.id }, select: { _count: { select: { questions: true } } } }),
    ]);
    const ordered = sortLessons(lessons);
    current = {
      topic: { name: active.name, slug: active.slug, bookTitle: active.book.title },
      totalLessons: ordered.length,
      doneLessons: ordered.filter((l) => done.has(l.id)).length,
      totalDays: ordered.at(-1)?.dayNumber ?? 0,
      nextLesson: ordered.find((l) => !done.has(l.id)) ?? null,
      quizReady: ordered.every((l) => done.has(l.id)) && (quiz?._count.questions ?? 0) > 0,
    };
  }

  // Sans thème actif : premier thème non validé de chaque livre.
  let suggestions: { slug: string; name: string; bookTitle: string; days: number }[] = [];
  if (!active && booksCount > 0) {
    const topics = await prisma.topic.findMany({
      where: { ownerId: userId, status: 'READY', userProgresses: { none: { userId, status: 'COMPLETED' } } },
      orderBy: [{ book: { createdAt: 'desc' } }, { position: 'asc' }],
      select: { slug: true, name: true, bookId: true, book: { select: { title: true } }, lessons: { select: { dayNumber: true }, orderBy: { dayNumber: 'desc' }, take: 1 } },
    });
    const seen = new Set<string>();
    for (const t of topics) {
      if (seen.has(t.bookId)) continue;
      seen.add(t.bookId);
      suggestions.push({ slug: t.slug, name: t.name, bookTitle: t.book.title, days: t.lessons[0]?.dayNumber ?? 0 });
    }
    suggestions = suggestions.slice(0, 3);
  }

  const topicsInPreparation =
    !active && suggestions.length === 0 && booksCount > 0
      ? await prisma.topic.count({ where: { ownerId: userId, status: { not: 'READY' } } })
      : 0;

  return {
    name: user?.name ?? '',
    topicsInPreparation,
    totalXp: user?.totalXp ?? 0,
    // La série est rompue si la dernière leçon date d'avant-hier ou plus.
    streak: user && [todayStr(), yesterdayStr()].includes(user.lastSessionDate ?? '') ? user.currentStreak : 0,
    doneToday: week[6].lessons,
    week,
    booksCount,
    current,
    suggestions,
    imports: imports.map((j) => ({
      id: j.id,
      status: j.status,
      title: j.book?.title ?? j.fileName,
      done: j.cursor,
      total: Array.isArray(j.queue) ? j.queue.length : 0,
    })),
  };
}

export type TodayView = Awaited<ReturnType<typeof getToday>>;
