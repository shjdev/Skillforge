// Validation et normalisation des réponses de l'IA. Fonctions pures (testées) :
// la sortie d'un modèle n'est jamais utilisée telle quelle.

import { z } from 'zod';

const text = (max: number) => z.string().transform((s) => s.trim().slice(0, max));
const clampInt = (min: number, max: number, fallback: number) =>
  z.unknown().optional().transform((v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  });

// ─── Analyse du document ────────────────────────────────────────────────────

const rawAnalysisSchema = z.object({
  isTeachable: z.boolean().catch(true),
  rejectionReason: text(300).catch(''),
  title: text(200).catch(''),
  author: text(160).catch(''),
  summary: text(600).catch(''),
  category: text(60).catch(''),
  topics: z
    .array(
      z.object({
        name: text(120),
        description: text(400).catch(''),
        chunkStart: z.unknown(),
        chunkEnd: z.unknown(),
        maxDifficultyLevel: clampInt(1, 5, 3),
      }),
    )
    .catch([]),
  days: z
    .array(
      z.object({
        chunk: z.unknown(),
        title: text(160).catch(''),
        objective: text(300).catch(''),
        difficultyLevel: clampInt(1, 5, 2),
      }),
    )
    .catch([]),
});

export interface AnalysisTopic {
  name: string;
  description: string;
  chunkStart: number;
  chunkEnd: number;
  maxDifficultyLevel: number;
}

export interface DayPlan {
  chunk: number;
  title: string;
  objective: string;
  difficultyLevel: number;
}

export interface BookAnalysis {
  isTeachable: boolean;
  rejectionReason: string;
  title: string;
  author: string;
  summary: string;
  category: string;
  topics: AnalysisTopic[];
  days: DayPlan[];
}

/**
 * Valide l'analyse et la rend cohérente : thèmes triés, contigus, sans
 * chevauchement et couvrant tous les extraits de 1 à totalChunks ; un plan
 * pour chaque extrait.
 */
export function parseAnalysis(raw: unknown, totalChunks: number): BookAnalysis {
  const data = rawAnalysisSchema.parse(raw);
  const toChunk = (v: unknown, fallback: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(1, Math.min(totalChunks, n)) : fallback;
  };

  const sorted = data.topics
    .filter((t) => t.name)
    .map((t) => {
      let start = toChunk(t.chunkStart, 1);
      let end = toChunk(t.chunkEnd, start);
      if (end < start) [start, end] = [end, start];
      return { ...t, chunkStart: start, chunkEnd: end };
    })
    .sort((a, b) => a.chunkStart - b.chunkStart);

  // Supprime les chevauchements et comble les trous en étendant le thème précédent.
  const topics: AnalysisTopic[] = [];
  for (const t of sorted) {
    const prev = topics[topics.length - 1];
    const start = prev ? prev.chunkEnd + 1 : 1;
    if (start > totalChunks || t.chunkEnd < start) continue;
    if (prev) prev.chunkEnd = Math.max(prev.chunkEnd, start - 1);
    topics.push({ ...t, chunkStart: start, chunkEnd: Math.max(start, t.chunkEnd) });
  }
  if (topics.length === 0 && totalChunks > 0) {
    topics.push({
      name: data.title || 'Parcours complet',
      description: data.summary,
      chunkStart: 1,
      chunkEnd: totalChunks,
      maxDifficultyLevel: 3,
    });
  }
  if (topics.length > 0) topics[topics.length - 1].chunkEnd = totalChunks;

  const dayByChunk = new Map<number, DayPlan>();
  for (const d of data.days) {
    const chunk = toChunk(d.chunk, NaN);
    if (Number.isFinite(chunk) && !dayByChunk.has(chunk)) dayByChunk.set(chunk, { ...d, chunk });
  }
  const days: DayPlan[] = [];
  for (let chunk = 1; chunk <= totalChunks; chunk++) {
    days.push(dayByChunk.get(chunk) ?? { chunk, title: `Partie ${chunk}`, objective: '', difficultyLevel: 2 });
  }

  return {
    isTeachable: data.isTeachable && totalChunks > 0,
    rejectionReason: data.rejectionReason,
    title: data.title,
    author: data.author,
    summary: data.summary,
    category: data.category,
    topics,
    days,
  };
}

// ─── Génération d'un extrait ────────────────────────────────────────────────

export const MIN_LESSON_CHARS = 400;

const rawChunkSchema = z.object({
  lessons: z.array(
    z.object({
      title: text(200),
      sessionType: z.string().catch('FULL_DAY'),
      contentMd: z.string(),
      chapterCitation: text(200).catch(''),
      keyConcepts: z.array(z.string()).catch([]),
    }),
  ),
  quizQuestions: z
    .array(
      z.object({
        questionText: text(600),
        options: z.array(z.string()),
        correctAnswer: z.string(),
        explanation: text(800).catch(''),
      }),
    )
    .catch([]),
});

export interface GeneratedLesson {
  title: string;
  sessionType: 'MORNING' | 'EVENING' | 'FULL_DAY';
  contentMd: string;
  chapterCitation: string;
  keyConcepts: string[];
}

export interface GeneratedQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

/**
 * Valide la sortie d'un extrait : 1 ou 2 leçons d'au moins MIN_LESSON_CHARS
 * caractères, questions gardées seulement si la bonne réponse fait partie des
 * choix. Lève une erreur si aucune leçon exploitable (l'appel sera réessayé).
 */
export function parseChunkOutput(raw: unknown): { lessons: GeneratedLesson[]; questions: GeneratedQuestion[] } {
  const data = rawChunkSchema.parse(raw);
  const lessons = data.lessons
    .filter((l) => l.title && l.contentMd.trim().length >= MIN_LESSON_CHARS)
    .slice(0, 2)
    .map((l, i) => ({
      title: l.title,
      sessionType: (['MORNING', 'EVENING', 'FULL_DAY'].includes(l.sessionType)
        ? l.sessionType
        : i === 0
          ? 'MORNING'
          : 'EVENING') as GeneratedLesson['sessionType'],
      contentMd: l.contentMd.trim().slice(0, 60_000),
      chapterCitation: l.chapterCitation,
      keyConcepts: l.keyConcepts.map((c) => c.trim().slice(0, 120)).filter(Boolean).slice(0, 12),
    }));
  if (lessons.length === 0) {
    throw new Error("Aucune leçon exploitable dans la réponse de l'IA.");
  }

  const questions = data.quizQuestions
    .map((q) => {
      const options = [...new Set(q.options.map((o) => o.trim().slice(0, 300)).filter(Boolean))].slice(0, 6);
      const correct = q.correctAnswer.trim();
      return { questionText: q.questionText, options, correctAnswer: correct, explanation: q.explanation };
    })
    .filter((q) => q.questionText && q.options.length >= 2 && q.options.includes(q.correctAnswer))
    .slice(0, 4);

  return { lessons, questions };
}
