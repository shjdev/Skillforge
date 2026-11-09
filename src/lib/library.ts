// Lecture de la bibliothèque d'un utilisateur : livres, thèmes et avancement.
// Toutes les requêtes filtrent sur le propriétaire.

import { prisma } from '@/lib/prisma';

export type TopicState = 'GENERATING' | 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'NOT_STARTED' | 'IN_PROGRESS';

/** Leçons terminées par l'utilisateur, par thème. */
export async function completedLessonsByTopic(userId: string, topicIds: string[]): Promise<Map<string, number>> {
  if (topicIds.length === 0) return new Map();
  const sessions = await prisma.userSession.findMany({
    where: { userId, completed: true, lesson: { topicId: { in: topicIds } } },
    select: { lessonId: true, lesson: { select: { topicId: true } } },
    distinct: ['lessonId'],
  });
  const counts = new Map<string, number>();
  for (const s of sessions) counts.set(s.lesson.topicId, (counts.get(s.lesson.topicId) ?? 0) + 1);
  return counts;
}

/** Imports en cours, par livre. */
async function activeImportsByBook(ownerId: string) {
  const jobs = await prisma.importJob.findMany({
    where: { ownerId, status: 'GENERATING', bookId: { not: null } },
    select: { id: true, bookId: true, cursor: true, queue: true },
  });
  return new Map(
    jobs.map((j) => [j.bookId!, { jobId: j.id, done: j.cursor, total: Array.isArray(j.queue) ? j.queue.length : 0 }]),
  );
}

export async function listBooks(userId: string) {
  const [books, imports, categories] = await Promise.all([
    prisma.book.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { name: true } },
        topics: { select: { id: true, _count: { select: { lessons: true } } } },
      },
    }),
    activeImportsByBook(userId),
    prisma.category.findMany({ where: { ownerId: userId, books: { some: {} } }, orderBy: { name: 'asc' }, select: { name: true } }),
  ]);
  const done = await completedLessonsByTopic(
    userId,
    books.flatMap((b) => b.topics.map((t) => t.id)),
  );

  return {
    categories: categories.map((c) => c.name),
    books: books.map((b) => {
      const totalLessons = b.topics.reduce((sum, t) => sum + t._count.lessons, 0);
      const doneLessons = b.topics.reduce((sum, t) => sum + (done.get(t.id) ?? 0), 0);
      return {
        id: b.id,
        title: b.title,
        author: b.author,
        category: b.category?.name ?? null,
        status: b.status,
        topicsCount: b.topics.length,
        totalLessons,
        doneLessons,
        import: imports.get(b.id) ?? null,
        createdAt: b.createdAt.toISOString(),
      };
    }),
  };
}

export type BookSummary = Awaited<ReturnType<typeof listBooks>>['books'][number];

export async function getBook(userId: string, bookId: string) {
  const book = await prisma.book.findFirst({
    where: { id: bookId, ownerId: userId },
    include: {
      category: { select: { name: true } },
      topics: {
        orderBy: { position: 'asc' },
        include: {
          _count: { select: { lessons: true } },
          lessons: { select: { dayNumber: true }, orderBy: { dayNumber: 'desc' }, take: 1 },
          quiz: { select: { id: true, _count: { select: { questions: true } } } },
          userProgresses: { where: { userId }, select: { status: true, currentDay: true } },
        },
      },
    },
  });
  if (!book) return null;

  const [user, imports, done] = await Promise.all([
    prisma.userProfile.findUnique({ where: { id: userId }, select: { currentActiveTopicId: true } }),
    activeImportsByBook(userId),
    completedLessonsByTopic(
      userId,
      book.topics.map((t) => t.id),
    ),
  ]);
  const activeTopicId = user?.currentActiveTopicId ?? null;
  const activeTopic =
    activeTopicId && !book.topics.some((t) => t.id === activeTopicId)
      ? await prisma.topic.findFirst({
          where: { id: activeTopicId, ownerId: userId },
          select: { name: true, slug: true, book: { select: { title: true } } },
        })
      : null;

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    summary: book.summary,
    fileName: book.fileName,
    category: book.category?.name ?? null,
    status: book.status,
    createdAt: book.createdAt.toISOString(),
    import: imports.get(book.id) ?? null,
    /** Thème actif d'un autre livre (bloque le démarrage d'un thème ici). */
    activeElsewhere: activeTopic ? { name: activeTopic.name, slug: activeTopic.slug, bookTitle: activeTopic.book.title } : null,
    topics: book.topics.map((t) => {
      const progress = t.userProgresses[0];
      const doneLessons = done.get(t.id) ?? 0;
      const state: TopicState =
        t.status !== 'READY'
          ? t.status === 'GENERATING'
            ? 'GENERATING'
            : 'PENDING'
          : progress?.status === 'COMPLETED'
            ? 'COMPLETED'
            : t.id === activeTopicId
              ? 'ACTIVE'
              : progress || doneLessons > 0
                ? 'IN_PROGRESS'
                : 'NOT_STARTED';
      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        description: t.description,
        position: t.position,
        maxDifficultyLevel: t.maxDifficultyLevel,
        // Jours prévus tant que le thème se génère, jours réellement créés ensuite.
        days: t.status === 'READY' ? (t.lessons[0]?.dayNumber ?? 0) : t.chunkEnd - t.chunkStart + 1,
        totalLessons: t._count.lessons,
        doneLessons,
        quizQuestions: t.quiz?._count.questions ?? 0,
        state,
      };
    }),
  };
}

export type BookDetail = NonNullable<Awaited<ReturnType<typeof getBook>>>;

/**
 * Supprime un livre et tout son contenu. Arrête l'import en cours et libère
 * le thème actif s'il appartenait à ce livre.
 */
export async function deleteBook(userId: string, bookId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const book = await tx.book.findFirst({ where: { id: bookId, ownerId: userId }, select: { id: true } });
    if (!book) return false;
    await tx.importJob.updateMany({
      where: { bookId, status: { in: ['GENERATING', 'REVIEW', 'ANALYZING'] } },
      data: { status: 'CANCELLED', chunks: [] },
    });
    const user = await tx.userProfile.findUnique({ where: { id: userId }, select: { currentActiveTopicId: true } });
    if (user?.currentActiveTopicId) {
      const owned = await tx.topic.count({ where: { id: user.currentActiveTopicId, bookId } });
      if (owned) await tx.userProfile.update({ where: { id: userId }, data: { currentActiveTopicId: null } });
    }
    await tx.book.delete({ where: { id: bookId } });
    return true;
  });
}

/** Modifie le titre, l'auteur ou la catégorie (créée au besoin, l'ancienne vide est retirée). */
export async function updateBook(
  userId: string,
  bookId: string,
  data: { title?: string; author?: string; category?: string },
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const book = await tx.book.findFirst({ where: { id: bookId, ownerId: userId }, select: { categoryId: true } });
    if (!book) return false;
    let categoryId = book.categoryId;
    if (data.category !== undefined) {
      const name = data.category.trim().slice(0, 60);
      categoryId = name
        ? (
            await tx.category.upsert({
              where: { ownerId_name: { ownerId: userId, name } },
              create: { ownerId: userId, name },
              update: {},
            })
          ).id
        : null;
    }
    await tx.book.update({
      where: { id: bookId },
      data: {
        ...(data.title?.trim() ? { title: data.title.trim().slice(0, 200) } : {}),
        ...(data.author !== undefined ? { author: data.author.trim().slice(0, 160) } : {}),
        categoryId,
      },
    });
    if (book.categoryId && book.categoryId !== categoryId) {
      await tx.category.deleteMany({ where: { id: book.categoryId, books: { none: {} } } });
    }
    return true;
  });
}
