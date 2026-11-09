// Cycle de vie d'un import : fichier → analyse → validation → génération jour
// par jour. Chaque étape est une requête courte pilotée par le navigateur, ce
// qui permet de reprendre un import interrompu.

import type { ImportJob, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { uniqueSlug } from '@/lib/slug';
import { AppError } from '@/lib/app-error';
import { AiError, generateJson } from './gemini';
import { analysisPrompt, formatTopicOutline, lessonPrompt } from './prompts';
import { afterFailure, buildQueue, isLastOfTopic, topicDayCount, type QueueItem } from './queue';
import { parseAnalysis, parseChunkOutput, type BookAnalysis, type DayPlan } from './schemas';
import { MIN_TEXT_CHARS, chunkText, extractText } from './text';

/** Un import resté en analyse plus longtemps a été interrompu (fonction coupée). */
const STALE_ANALYSIS_MS = 6 * 60 * 1000;

export const ACTIVE_STATUSES = ['ANALYZING', 'REVIEW', 'GENERATING'] as const;


interface LastGenerated {
  topicId: string;
  title: string;
  concepts: string[];
}

const json = (v: unknown) => v as Prisma.InputJsonValue;
const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);

// ─── Lecture ────────────────────────────────────────────────────────────────

/** Vue d'un import envoyée au navigateur (jamais le texte du livre). */
export function serializeJob(job: ImportJob) {
  const queue = (job.queue as unknown as QueueItem[]) ?? [];
  const stale = job.status === 'ANALYZING' && Date.now() - job.updatedAt.getTime() > STALE_ANALYSIS_MS;
  const analysis = job.analysis as unknown as BookAnalysis | null;
  return {
    id: job.id,
    status: stale ? 'ERROR' : job.status,
    error: stale ? "L'analyse a été interrompue. Relancez l'import." : job.error,
    fileName: job.fileName,
    fileSize: job.fileSize,
    bookId: job.bookId,
    analysis: analysis && {
      isTeachable: analysis.isTeachable,
      rejectionReason: analysis.rejectionReason,
      title: analysis.title,
      author: analysis.author,
      summary: analysis.summary,
      category: analysis.category,
      topics: analysis.topics,
      totalDays: analysis.days.length,
    },
    progress: { done: Math.min(job.cursor, queue.length), total: queue.length },
    current: queue[job.cursor] ?? null,
    skipped: Array.isArray(job.skippedChunks) ? job.skippedChunks.length : 0,
    lessonsCreated: job.lessonsCreated,
    questionsCreated: job.questionsCreated,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export type ImportJobView = ReturnType<typeof serializeJob>;

export async function getOwnJob(jobId: string, ownerId: string): Promise<ImportJob> {
  const job = await prisma.importJob.findFirst({ where: { id: jobId, ownerId } });
  if (!job) throw new AppError('Import introuvable.', 404);
  return job;
}

// ─── 1. Création + analyse ──────────────────────────────────────────────────

/**
 * Extrait le texte, le découpe et demande à l'IA le plan du livre. Le job
 * passe en REVIEW (à valider par l'utilisateur) ou en ERROR.
 */
export async function createImport(params: {
  ownerId: string;
  fileName: string;
  fileSize: number;
  buffer: Buffer;
  apiKey: string;
  personalKey: boolean;
}): Promise<ImportJob> {
  const { ownerId, fileName, fileSize, buffer, apiKey, personalKey } = params;
  const job = await prisma.importJob.create({
    data: { ownerId, fileName: fileName.slice(0, 200), fileSize, personalKey, status: 'ANALYZING' },
  });

  try {
    const text = await extractText(fileName, buffer, { apiKey });
    if (text.replace(/\s+/g, '').length < MIN_TEXT_CHARS) {
      throw new AppError('Le document contient trop peu de texte pour en faire un parcours.');
    }
    const chunks = chunkText(text);
    const categories = await prisma.category.findMany({ where: { ownerId }, select: { name: true } });
    const analysis = await generateJson(
      apiKey,
      analysisPrompt(
        chunks,
        categories.map((c) => c.name),
      ),
      (raw) => parseAnalysis(raw, chunks.length),
    );

    return await prisma.importJob.update({
      where: { id: job.id },
      data: analysis.isTeachable
        ? { status: 'REVIEW', chunks: json(chunks), analysis: json(analysis) }
        : {
            status: 'ERROR',
            analysis: json(analysis),
            error: `Ce document ne se prête pas à un parcours d'apprentissage${analysis.rejectionReason ? ` : ${analysis.rejectionReason}` : '.'}`,
          },
    });
  } catch (err) {
    const message =
      err instanceof AiError && err.transient
        ? "L'IA est très sollicitée en ce moment : relancez l'import dans quelques minutes (il ne compte pas dans votre limite)."
        : err instanceof Error
          ? err.message
          : '';
    console.error('[import] Analyse impossible :', err);
    return prisma.importJob.update({
      where: { id: job.id },
      data: { status: 'ERROR', error: message || "Impossible d'analyser ce fichier." },
    });
  }
}

// ─── 2. Validation par l'utilisateur ────────────────────────────────────────

export interface ConfirmEdits {
  title?: string;
  author?: string;
  category?: string;
  /** Noms des thèmes, dans l'ordre (les plages d'extraits ne changent pas). */
  topicNames?: string[];
}

/** Crée le livre, ses thèmes et leurs quiz, puis lance la génération. */
export async function confirmImport(jobId: string, ownerId: string, edits: ConfirmEdits): Promise<ImportJob> {
  const job = await getOwnJob(jobId, ownerId);
  if (job.status !== 'REVIEW') throw new AppError("Cet import n'attend pas de validation.", 409);
  const analysis = job.analysis as unknown as BookAnalysis;

  const clean = (value: string | undefined, fallback: string, max: number) => (value?.trim() || fallback).slice(0, max);
  const title = clean(edits.title, analysis.title || job.fileName.replace(/\.[^.]+$/, ''), 200);
  const author = clean(edits.author, analysis.author, 160);
  const categoryName = clean(edits.category, analysis.category || 'Divers', 60);

  return prisma.$transaction(async (tx) => {
    // Revérifie l'état dans la transaction : un double clic ne crée pas deux livres.
    const claimed = await tx.importJob.updateMany({
      where: { id: job.id, status: 'REVIEW' },
      data: { status: 'GENERATING' },
    });
    if (claimed.count === 0) throw new AppError('Cet import est déjà lancé.', 409);

    const category = await tx.category.upsert({
      where: { ownerId_name: { ownerId, name: categoryName } },
      create: { ownerId, name: categoryName },
      update: {},
    });
    const book = await tx.book.create({
      data: { ownerId, categoryId: category.id, title, author, summary: analysis.summary, fileName: job.fileName },
    });

    const existing = await tx.topic.findMany({ where: { ownerId }, select: { slug: true } });
    const taken = new Set(existing.map((t) => t.slug));
    const topics = [];
    for (const [i, t] of analysis.topics.entries()) {
      const name = clean(edits.topicNames?.[i], t.name, 120);
      const topic = await tx.topic.create({
        data: {
          ownerId,
          bookId: book.id,
          slug: uniqueSlug(name, taken),
          name,
          description: t.description,
          position: i + 1,
          maxDifficultyLevel: t.maxDifficultyLevel,
          chunkStart: t.chunkStart,
          chunkEnd: t.chunkEnd,
          status: i === 0 ? 'GENERATING' : 'PENDING',
          quiz: { create: { title: `Quiz — ${name}` } },
        },
      });
      topics.push(topic);
    }

    return tx.importJob.update({
      where: { id: job.id },
      data: { bookId: book.id, queue: json(buildQueue(topics)), cursor: 0, failures: 0 },
    });
  });
}

// ─── 3. Génération, un jour à la fois ───────────────────────────────────────

/**
 * Génère les leçons de l'extrait courant. Idempotent : si deux appels
 * traitent le même extrait, seul le premier à enregistrer est conservé.
 */
export async function runStep(jobId: string, ownerId: string, key: { apiKey: string; personal: boolean }): Promise<ImportJob> {
  const job = await getOwnJob(jobId, ownerId);
  if (job.status !== 'GENERATING' || !job.bookId) return job;
  // Un import lancé hors quota ne doit jamais basculer sur la clé du serveur.
  if (job.personalKey && !key.personal) {
    throw new AppError('Cet import utilise votre clé Gemini personnelle : ajoutez-la de nouveau dans les réglages pour continuer.', 403);
  }
  const { apiKey } = key;

  const queue = job.queue as unknown as QueueItem[];
  const item = queue[job.cursor];
  if (!item) return finalizeImport(job.id, 'DONE');

  const chunks = asStrings(job.chunks);
  const analysis = job.analysis as unknown as BookAnalysis;
  const [book, topic] = await Promise.all([
    prisma.book.findUniqueOrThrow({ where: { id: job.bookId } }),
    prisma.topic.findUniqueOrThrow({ where: { id: item.topicId }, include: { quiz: true } }),
  ]);

  const topicPlan: DayPlan[] = analysis.days.filter((d) => d.chunk >= topic.chunkStart && d.chunk <= topic.chunkEnd);
  const planFor = (chunk: number) => analysis.days.find((d) => d.chunk === chunk);
  const last = job.lastGenerated as unknown as LastGenerated | null;

  let output: ReturnType<typeof parseChunkOutput>;
  try {
    output = await generateJson(
      apiKey,
      lessonPrompt({
        bookTitle: book.title,
        bookAuthor: book.author,
        topicName: topic.name,
        dayNumber: item.dayNumber,
        topicDays: topicDayCount(queue, topic.id),
        chunk: chunks[item.chunk - 1] ?? '',
        plan: {
          current: planFor(item.chunk),
          prev: item.dayNumber > 1 ? planFor(item.chunk - 1) : undefined,
          next: isLastOfTopic(queue, job.cursor) ? undefined : planFor(item.chunk + 1),
        },
        topicOutline: formatTopicOutline(topicPlan),
        previous: last && last.topicId === topic.id ? { title: last.title, concepts: last.concepts } : null,
      }),
      parseChunkOutput,
    );
  } catch (err) {
    // Surcharge passagère : rien n'est compté, le navigateur réessaie plus tard.
    if (err instanceof AiError && err.transient) {
      await prisma.importJob.update({ where: { id: job.id }, data: { error: err.message } });
      throw err;
    }
    return recordFailure(job, err);
  }

  const difficulty = planFor(item.chunk)?.difficultyLevel ?? 2;
  const lastOfTopic = isLastOfTopic(queue, job.cursor);
  const nextItem = queue[job.cursor + 1];

  await prisma.$transaction(async (tx) => {
    const advanced = await tx.importJob.updateMany({
      where: { id: job.id, cursor: job.cursor, status: 'GENERATING' },
      data: {
        cursor: job.cursor + 1,
        failures: 0,
        error: null,
        lessonsCreated: { increment: output.lessons.length },
        questionsCreated: { increment: output.questions.length },
        lastGenerated: json({
          topicId: topic.id,
          title: output.lessons[0].title,
          concepts: output.lessons.flatMap((l) => l.keyConcepts),
        } satisfies LastGenerated),
      },
    });
    if (advanced.count === 0) return; // déjà traité par un autre appel

    await tx.lesson.createMany({
      data: output.lessons.map((l) => ({
        topicId: topic.id,
        title: l.title,
        contentMd: l.contentMd,
        dayNumber: item.dayNumber,
        sessionType: l.sessionType,
        difficultyLevel: difficulty,
        durationMinutes: estimateMinutes(l.contentMd),
        keyConcepts: json(l.keyConcepts),
        chapterCitation: l.chapterCitation || null,
      })),
    });
    if (topic.quiz && output.questions.length) {
      await tx.quizQuestion.createMany({
        data: output.questions.map((q) => ({
          quizId: topic.quiz!.id,
          dayNumber: item.dayNumber,
          questionText: q.questionText,
          // L'IA place souvent la bonne réponse au même rang : on mélange.
          options: json(shuffle(q.options)),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        })),
      });
    }
    if (lastOfTopic) {
      await tx.topic.update({ where: { id: topic.id }, data: { status: 'READY' } });
      if (nextItem) await tx.topic.update({ where: { id: nextItem.topicId }, data: { status: 'GENERATING' } });
    }
  });

  const updated = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
  return updated.cursor >= queue.length ? finalizeImport(job.id, 'DONE') : updated;
}

async function recordFailure(job: ImportJob, err: unknown): Promise<ImportJob> {
  const message = err instanceof Error ? err.message : "L'IA n'a pas pu générer ce jour.";
  console.warn(`[import] Échec sur l'extrait ${job.cursor + 1} :`, err);
  // Clé invalide ou quota : réessayer ne sert à rien tant que l'utilisateur n'a pas agi.
  const blocking = err instanceof AiError && /Clé Gemini|Quota|accès à ce modèle/.test(err.message);
  if (blocking) {
    return prisma.importJob.update({ where: { id: job.id }, data: { error: message } });
  }

  const { failures, skip } = afterFailure(job.failures);
  if (!skip) {
    return prisma.importJob.update({ where: { id: job.id }, data: { failures, error: message } });
  }

  const queue = job.queue as unknown as QueueItem[];
  const item = queue[job.cursor];
  const lastOfTopic = isLastOfTopic(queue, job.cursor);
  const nextItem = queue[job.cursor + 1];
  const skipped = Array.isArray(job.skippedChunks) ? [...(job.skippedChunks as number[]), item.chunk] : [item.chunk];

  await prisma.$transaction(async (tx) => {
    const advanced = await tx.importJob.updateMany({
      where: { id: job.id, cursor: job.cursor, status: 'GENERATING' },
      data: { cursor: job.cursor + 1, failures: 0, error: null, skippedChunks: json(skipped) },
    });
    if (advanced.count === 0 || !lastOfTopic) return;
    const lessons = await tx.lesson.count({ where: { topicId: item.topicId } });
    await tx.topic.update({ where: { id: item.topicId }, data: { status: lessons > 0 ? 'READY' : 'ERROR' } });
    if (nextItem) await tx.topic.update({ where: { id: nextItem.topicId }, data: { status: 'GENERATING' } });
  });

  const updated = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
  return updated.cursor >= queue.length ? finalizeImport(job.id, 'DONE') : updated;
}

// ─── 4. Fin ou annulation ───────────────────────────────────────────────────

/**
 * Termine l'import : les thèmes sans leçon sont retirés, le livre est prêt
 * s'il lui reste au moins un thème, sinon il est supprimé. Le texte est effacé.
 */
async function finalizeImport(jobId: string, status: 'DONE' | 'CANCELLED'): Promise<ImportJob> {
  return prisma.$transaction(async (tx) => {
    const job = await tx.importJob.findUniqueOrThrow({ where: { id: jobId } });
    if (job.status !== 'GENERATING' && job.status !== 'REVIEW' && job.status !== 'ANALYZING') return job;

    let bookId = job.bookId;
    if (bookId) {
      const topics = await tx.topic.findMany({
        where: { bookId },
        select: { id: true, _count: { select: { lessons: true } } },
      });
      const empty = topics.filter((t) => t._count.lessons === 0).map((t) => t.id);
      if (empty.length) await tx.topic.deleteMany({ where: { id: { in: empty } } });
      await tx.topic.updateMany({ where: { bookId, status: { not: 'READY' } }, data: { status: 'READY' } });

      if (empty.length === topics.length) {
        await tx.book.delete({ where: { id: bookId } });
        bookId = null;
      } else {
        await tx.book.update({ where: { id: bookId }, data: { status: 'READY' } });
      }
    }

    const nothingMade = status === 'DONE' && !bookId;
    return tx.importJob.update({
      where: { id: jobId },
      data: {
        status: nothingMade ? 'ERROR' : status,
        error: nothingMade ? "Aucune leçon n'a pu être générée à partir de ce document." : null,
        bookId,
        chunks: json([]),
      },
    });
  });
}

/** Annule un import : ce qui est déjà généré est conservé. */
export async function cancelImport(jobId: string, ownerId: string): Promise<ImportJob> {
  const job = await getOwnJob(jobId, ownerId);
  if (!ACTIVE_STATUSES.includes(job.status as (typeof ACTIVE_STATUSES)[number])) return job;
  return finalizeImport(job.id, 'CANCELLED');
}

/** Mélange de Fisher-Yates (copie). */
export function shuffle<T>(items: T[], random = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Durée de lecture estimée : ~180 mots par minute, entre 10 et 60 min. */
export function estimateMinutes(markdown: string): number {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return Math.max(10, Math.min(60, Math.round(words / 180 / 5) * 5 || 10));
}
