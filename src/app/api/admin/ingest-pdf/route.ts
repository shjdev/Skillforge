import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenAI } from '@google/genai';
import { chunkText, extractPdfText, fetchBlobBuffer, BASE_CHUNKS, PLAN_OVERVIEW_CHARS } from '@/lib/ingestion';
import { getSessionContext } from '@/lib/serverAuth';
import { canWrite, resolveNewOwnerId } from '@/lib/ownership';

export const maxDuration = 300;

const MIN_CHUNKS = 6;
const MAX_CHUNKS = 15;
const LESSONS_PER_CHUNK = 2;
const QUIZ_PASSING_SCORE = 80;
const GENERATION_MODEL = 'gemini-3.6-flash';

export interface GeneratedLesson {
  title: string;
  sessionType: string;
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
export interface PlanEntry {
  dayNumber: number;
  title: string;
  objective: string;
  difficultyLevel: number;
}

function planPrompt(chunks: { content: string; index: number }[], title: string, author: string, maxDifficultyLevel: number): string {
  const overview = chunks
    .map((c) => `--- Extrait ${c.index}/${chunks.length} ---\n${c.content.slice(0, PLAN_OVERVIEW_CHARS)}${c.content.length > PLAN_OVERVIEW_CHARS ? '…' : ''}`)
    .join('\n\n');

  return `Tu es un architecte pédagogique. Voici un aperçu de ${chunks.length} extraits successifs du livre "${title}" par ${author}, dans l'ordre du livre :

${overview}

Pour CHAQUE extrait (1 à ${chunks.length}), définis le sujet du jour de cours correspondant, de façon à ce que la progression d'un jour à l'autre soit logique et cumulative : chaque jour doit s'appuyer sur ce qui précède, sans redite ni saut de sujet incohérent. Si un extrait mélange plusieurs sujets, choisis-en un seul comme fil conducteur du jour et laisse le reste pour un jour suivant si pertinent.

Attribue à chaque jour un niveau de difficulté de 1 à ${maxDifficultyLevel} qui reflète la VRAIE complexité pédagogique du contenu (pas juste sa position dans le livre) : 1 = notions de base sans prérequis, ${maxDifficultyLevel} = expert. La difficulté doit rester globalement progressive sur l'ensemble du cursus.

Réponds STRICTEMENT en JSON valide selon ce schéma, avec exactement un élément par extrait :
{
  "plan": [
    { "dayNumber": 1, "title": "Titre concis du sujet du jour", "objective": "Ce que l'apprenant doit comprendre/savoir faire à la fin de ce jour, en une phrase", "difficultyLevel": 1 }
  ]
}`;
}

function lessonPrompt(
  chunk: { content: string; index: number },
  title: string,
  author: string,
  totalChunks: number,
  difficultyLevel: number,
  context: { current?: PlanEntry; prev?: PlanEntry; next?: PlanEntry },
  planOverview: string,
  prevGenerated?: { title: string; concepts: string[] }
): string {
  const dayNumber = chunk.index;
  const secondSession = dayNumber % 2 === 0 ? 'EVENING' : 'MORNING';
  const firstSession = secondSession === 'MORNING' ? 'EVENING' : 'MORNING';

  const continuityLines = [
    planOverview ? `Cursus complet (chaque jour est un maillon ; respectez l'arc global) :\n${planOverview}` : '',
    context.current
      ? `Sujet imposé pour ce jour : "${context.current.title}" — Objectif pédagogique : ${context.current.objective}`
      : '',
    context.prev
      ? `Au plan, le jour précédent couvrait : "${context.prev.title}" (n'y revenez pas, sauf un rappel d'une phrase si utile pour enchaîner)`
      : "C'est le premier jour du cursus : aucun rappel nécessaire.",
    prevGenerated
      ? `Rappel du contenu RÉELLEMENT généré hier — "${prevGenerated.title}" — concepts abordés : ${prevGenerated.concepts.slice(0, 6).join(' ; ')}. Ouvrez votre leçon par une transition naturelle depuis ces notions et ne les réexpliquez pas.`
      : '',
    context.next
      ? `Jour suivant (réservé pour plus tard, ne le traitez pas aujourd'hui) : "${context.next.title}"`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `Tu es un expert pédagogique en ingénierie informatique, en train d'écrire le JOUR ${dayNumber}/${totalChunks} d'un cursus cohérent et progressif basé sur le livre "${title}" par ${author}.

${continuityLines}

Extrait source à utiliser pour ce jour :
---
${chunk.content}
---

Génère exactement 2 leçons pour ce jour :
- Leçon 1 (session ${firstSession}) : théorie. Structure Markdown obligatoire : "## Introduction" (pourquoi ce sujet compte, lien avec le jour précédent, 2-3 phrases), "## Développement" (au moins 3 sous-parties en "###", chacune expliquée en profondeur avec au moins un exemple concret chiffré ou un cas réel), "## Pièges courants" (erreurs fréquentes de débutant sur ce sujet), "## Points clés à retenir" (liste synthétique). MINIMUM 800 MOTS rédigés en paragraphes complets et non en simples puces — un résumé court est refusé.
- Leçon 2 (session ${secondSession}) : pratique. Un exercice ou cas d'application directement lié à la théorie du jour, avec énoncé, étapes de résolution guidées numérotées, et une correction commentée expliquant POURQUOI chaque étape est correcte. MINIMUM 500 MOTS.
- Rédige en Français de haute qualité.
- TOUS les termes techniques doivent impérativement être suivis de leur terme d'origine en Anglais entre parenthèses. Ex : "Le protocole de transport (Transport Layer)".
- Inclus les citations précises du livre (chapitre et pages si identifiables).
- Niveau de difficulté imposé pour ce jour : ${difficultyLevel}/5, où 1 = vocabulaire simple, définitions intuitives, aucun prérequis ; 2 = notions de base illustrées ; 3 = intermédiaire, mécanismes détaillés et terminologie technique assumée ; 4 = avancé, cas complexes, compromis et subtilités ; 5 = expert, analyse critique et cas limites. Adapte vocabulaire, profondeur et exemples à ce niveau exact.
- Reste strictement dans le sujet du jour défini ci-dessus ; ne traite pas le sujet du jour suivant.

Réponds STRICTEMENT au format JSON valide selon ce schéma :
{
  "lessons": [
    {
      "title": "Titre de la leçon",
      "sessionType": "${firstSession}",
      "contentMd": "## Introduction\\n\\n...\\n\\n## Développement\\n\\n### Sous-partie 1\\n\\n...",
      "chapterCitation": "Chapitre X, pp. Y-Z",
      "keyConcepts": ["Concept 1 (English 1)", "Concept 2 (English 2)"]
    },
    {
      "title": "Titre de la leçon pratique",
      "sessionType": "${secondSession}",
      "contentMd": "## Énoncé\\n\\n...\\n\\n## Résolution guidée\\n\\n...\\n\\n## Correction commentée\\n\\n...",
      "chapterCitation": "Chapitre X, pp. Y-Z",
      "keyConcepts": ["Concept A (English A)"]
    }
  ],
  "quizQuestions": [
    {
      "questionText": "Question sur le contenu de CE jour",
      "options": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
      "correctAnswer": "Réponse A",
      "explanation": "Pourquoi cette réponse est correcte"
    }
  ]
}
Génère entre 2 et 3 quizQuestions couvrant uniquement le sujet de ce jour.`;
}

export function stripJsonFence(responseText: string): string {
  return responseText.replace(/```json\n?|\n?```/g, '').trim();
}

export function parseAiJson(responseText: string): { lessons: GeneratedLesson[]; quizQuestions: GeneratedQuestion[] } {
  const parsed = JSON.parse(stripJsonFence(responseText));
  return {
    lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
    quizQuestions: Array.isArray(parsed.quizQuestions) ? parsed.quizQuestions : [],
  };
}

export function formatPlanOverview(planEntries: PlanEntry[]): string {
  if (!planEntries || planEntries.length === 0) return '';
  return [...planEntries]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((e) => `- Jour ${e.dayNumber} : ${e.title}${e.objective ? ` (${e.objective})` : ''}`)
    .join('\n');
}

async function generatePlan(
  ai: GoogleGenAI,
  chunks: { content: string; index: number }[],
  title: string,
  author: string,
  maxDifficultyLevel: number
): Promise<Map<number, PlanEntry> | null> {
  try {
    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: planPrompt(chunks, title, author, maxDifficultyLevel),
    });
    const parsed = JSON.parse(stripJsonFence(response.text || ''));
    const entries: unknown[] = Array.isArray(parsed.plan) ? parsed.plan : [];

    const map = new Map<number, PlanEntry>();
    for (const raw of entries) {
      const e = raw as Partial<PlanEntry> | null;
      if (!e || typeof e.dayNumber !== 'number') continue;
      map.set(e.dayNumber, {
        dayNumber: e.dayNumber,
        title: String(e.title || `Jour ${e.dayNumber}`),
        objective: String(e.objective || ''),
        difficultyLevel: Math.max(1, Math.min(maxDifficultyLevel, Math.round(Number(e.difficultyLevel)) || 1)),
      });
    }
    return map.size > 0 ? map : null;
  } catch (err) {
    console.error('[ingest-pdf] Échec de la planification du cursus, repli sur une génération sans continuité :', err);
    return null;
  }
}

async function ensureBookAndQuiz(params: {
  bookId?: string | null;
  title: string;
  author: string;
  topicId: string;
  ownerId: string | null;
}): Promise<{ bookId: string; quizId: string }> {
  const { bookId, title, author, topicId, ownerId } = params;
  let resolvedBookId = bookId || '';
  if (resolvedBookId) {
    const existingBook = await prisma.bookReference.findUnique({ where: { id: resolvedBookId } });
    if (!existingBook) resolvedBookId = '';
  }
  if (!resolvedBookId) {
    const createdBook = await prisma.bookReference.create({
      data: {
        title,
        author,
        description: `Ouvrage ingéré pour le topic ${topicId}`,
        ownerId,
      },
    });
    resolvedBookId = createdBook.id;
  }

  const existingQuiz = await prisma.quiz.findFirst({
    where: { topicId, quizType: 'WEEKLY' },
  });
  let quizId: string;
  if (existingQuiz) {
    quizId = existingQuiz.id;
  } else {
    const createdQuiz = await prisma.quiz.create({
      data: {
        topicId,
        title: `Quiz de validation — ${title}`,
        difficultyLevel: 1,
        passingScore: QUIZ_PASSING_SCORE,
        quizType: 'WEEKLY',
      },
    });
    quizId = createdQuiz.id;
  }

  return { bookId: resolvedBookId, quizId };
}

/**
 * Persiste immédiatement en base les leçons et questions d'un extrait (chunk)
 * afin qu'aucune progression ne soit perdue en cas d'interruption réseau ou
 * de timeout serverless.
 */
async function persistChunkOutput(params: {
  topicId: string;
  bookId: string;
  quizId: string;
  title: string;
  dayNumber: number;
  difficultyLevel: number;
  lessons: GeneratedLesson[];
  quizQuestions: GeneratedQuestion[];
}): Promise<{ lessonsSaved: number; questionsSaved: number }> {
  const { topicId, bookId, quizId, title, dayNumber, difficultyLevel, lessons, quizQuestions } = params;
  const boundedLessons = lessons.slice(0, LESSONS_PER_CHUNK);
  let lessonsSaved = 0;
  let questionsSaved = 0;

  await prisma.$transaction(async (tx) => {
    for (const lesson of boundedLessons) {
      await tx.lesson.create({
        data: {
          topicId,
          title: lesson.title,
          contentMd: lesson.contentMd,
          dayNumber,
          sessionType: ['MORNING', 'EVENING', 'FULL_DAY'].includes(lesson.sessionType)
            ? lesson.sessionType
            : 'FULL_DAY',
          difficultyLevel,
          durationMinutes: 30,
          keyConcepts: JSON.stringify(lesson.keyConcepts || []),
          contentSource: 'ai',
          bookReferenceId: bookId,
          chapterCitation: lesson.chapterCitation || `Extrait du livre « ${title} »`,
        },
      });
      lessonsSaved += 1;
    }

    for (const q of quizQuestions) {
      if (!Array.isArray(q.options) || q.options.length < 2 || !q.correctAnswer) continue;
      await tx.quizQuestion.create({
        data: {
          quizId,
          questionText: q.questionText,
          options: JSON.stringify(q.options),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || '',
          points: 20,
          questionType: 'MCQ',
        },
      });
      questionsSaved += 1;
    }
  });

  return { lessonsSaved, questionsSaved };
}

async function processIngestJob(jobId: string, params: {
  topicId: string;
  bookId?: string | null;
  title: string;
  author: string;
  apiKey: string;
  chunks: { content: string; index: number }[];
  maxDifficultyLevel: number;
  ownerId: string | null;
}) {
  const { topicId, bookId: initialBookId, title, author, apiKey, chunks, maxDifficultyLevel, ownerId } = params;
  try {
    await prisma.ingestJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', totalChunks: chunks.length, message: 'Planification du cursus…' },
    });

    const ai = new GoogleGenAI({ apiKey });
    const plan = await generatePlan(ai, chunks, title, author, maxDifficultyLevel);
    const planOverview = plan ? formatPlanOverview(Array.from(plan.values())) : '';

    const { bookId, quizId } = await ensureBookAndQuiz({
      bookId: initialBookId,
      title,
      author,
      topicId,
      ownerId,
    });

    let totalLessonsSaved = 0;
    let totalQuestionsSaved = 0;
    let prevGenerated: { title: string; concepts: string[] } | undefined;

    for (const chunk of chunks) {
      const planEntry = plan?.get(chunk.index);
      const difficultyLevel =
        planEntry?.difficultyLevel ??
        Math.max(1, Math.min(maxDifficultyLevel, Math.ceil((chunk.index / chunks.length) * maxDifficultyLevel)));
      const context = { current: planEntry, prev: plan?.get(chunk.index - 1), next: plan?.get(chunk.index + 1) };

      try {
        const response = await ai.models.generateContent({
          model: GENERATION_MODEL,
          contents: lessonPrompt(chunk, title, author, chunks.length, difficultyLevel, context, planOverview, prevGenerated),
        });
        const { lessons, quizQuestions } = parseAiJson(response.text || '');
        const { lessonsSaved, questionsSaved } = await persistChunkOutput({
          topicId,
          bookId,
          quizId,
          title,
          dayNumber: chunk.index,
          difficultyLevel,
          lessons,
          quizQuestions,
        });
        totalLessonsSaved += lessonsSaved;
        totalQuestionsSaved += questionsSaved;

        const theoryLesson = lessons.find((l) => (l.keyConcepts || []).length > 0);
        if (theoryLesson) {
          prevGenerated = {
            title: theoryLesson.title,
            concepts: (theoryLesson.keyConcepts || []).filter((c) => typeof c === 'string'),
          };
        }
      } catch (err) {
        console.error(`[ingest-pdf] Échec de génération pour l'extrait ${chunk.index}/${chunks.length} :`, err);
      }

      await prisma.ingestJob.update({
        where: { id: jobId },
        data: {
          processedChunks: chunk.index,
          lessonsCreated: totalLessonsSaved,
          questionsCreated: totalQuestionsSaved,
          message: plan ? 'Génération selon le plan de cours…' : 'Génération (sans plan — extraits traités indépendamment)…',
        },
      });
    }

    if (totalLessonsSaved === 0) {
      await prisma.ingestJob.update({
        where: { id: jobId },
        data: { status: 'ERROR', message: 'La génération IA a échoué pour tous les extraits. Vérifiez la clé API et réessayez.' },
      });
      return;
    }

    await prisma.ingestJob.update({
      where: { id: jobId },
      data: {
        status: 'DONE',
        bookTitle: title,
        lessonsCreated: totalLessonsSaved,
        questionsCreated: totalQuestionsSaved,
        message:
          `${totalLessonsSaved} leçons et ${totalQuestionsSaved} questions créées` +
          (plan ? ' (avec plan de cursus cohérent).' : ' (plan indisponible — extraits traités indépendamment).') +
          (totalLessonsSaved < chunks.length * LESSONS_PER_CHUNK
            ? ` ${chunks.length - Math.floor(totalLessonsSaved / LESSONS_PER_CHUNK)} extrait(s) ont échoué et peuvent être relancés.`
            : ''),
      },
    });
  } catch (error) {
    console.error('Error in PDF ingestion job:', error);
    await prisma.ingestJob.update({
      where: { id: jobId },
      data: { status: 'ERROR', message: 'Échec du traitement du PDF ou de la génération IA.' },
    }).catch(() => {});
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileUrl = formData.get('fileUrl') as string | null;
    const title = (formData.get('title') as string) || 'Livre sans titre';
    const author = (formData.get('author') as string) || 'Auteur inconnu';
    const domainId = formData.get('domainId') as string;
    const topicId = formData.get('topicId') as string;
    const bookIdParam = (formData.get('bookId') as string) || null;
    const mode = (formData.get('mode') as string) || 'background';
    const isPersonal = formData.get('personal') === 'true';
    const apiKey = (formData.get('apiKey') as string) || process.env.GEMINI_API_KEY;
    const chunkStart = parseInt(formData.get('chunkStart') as string) || 0;
    const chunkEnd = parseInt(formData.get('chunkEnd') as string) || 0;
    const hasChunkRange = chunkStart >= 1 && chunkEnd >= chunkStart;

    if (!domainId || !topicId) {
      return NextResponse.json({ error: 'Le domaine et le topic sont requis' }, { status: 400 });
    }

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      select: { id: true, name: true, maxDifficultyLevel: true, estimatedWeeks: true, ownerId: true },
    });
    if (!topic) {
      return NextResponse.json({ error: 'Topic introuvable' }, { status: 404 });
    }

    const session = await getSessionContext();
    if (!canWrite(session, topic.ownerId)) {
      return NextResponse.json(
        { error: 'Vous ne pouvez générer des leçons que dans vos propres thèmes.' },
        { status: 403 },
      );
    }
    if (bookIdParam) {
      const existingBook = await prisma.bookReference.findUnique({
        where: { id: bookIdParam },
        select: { ownerId: true },
      });
      if (existingBook && !canWrite(session, existingBook.ownerId)) {
        return NextResponse.json(
          { error: 'Vous ne pouvez compléter que les livres que vous avez vous-même importés.' },
          { status: 403 },
        );
      }
    }
    // Les leçons d'un thème personnel appartiennent au propriétaire du thème.
    const ownerId = topic.ownerId ?? resolveNewOwnerId(session, isPersonal);

    // Purge uniquement des livres orphelins créés il y a plus de 30 minutes
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    await prisma.bookReference.deleteMany({
      where: { lessons: { none: {} }, addedAt: { lt: thirtyMinsAgo } },
    }).catch(() => {});

    let extractedText = '';
    if (file || fileUrl) {
      const buffer = file ? Buffer.from(await file.arrayBuffer()) : await fetchBlobBuffer(fileUrl as string);
      extractedText = await extractPdfText(buffer, { apiKey });
      if (!extractedText.trim()) {
        return NextResponse.json(
          { error: "Aucun texte exploitable n'a pu être extrait de ce fichier (même après tentative d'OCR IA)." },
          { status: 422 },
        );
      }
    } else {
      extractedText = (formData.get('rawText') as string) || '';
      if (!extractedText.trim()) {
        return NextResponse.json({ error: 'Fournissez un fichier ou un texte brut.' }, { status: 400 });
      }
    }

    if (!apiKey) {
      const bookRef = await prisma.bookReference.create({
        data: {
          title,
          author,
          description: `Ouvrage ingéré pour le topic ${topic.name}`,
          ownerId,
        },
      });
      return NextResponse.json({
        success: true,
        bookId: bookRef.id,
        message: 'Livre ajouté à la base. (Ajoutez une clé API Gemini pour la génération automatique AI).',
      });
    }

    const rawChunks = hasChunkRange
      ? chunkText(extractedText, BASE_CHUNKS).slice(chunkStart - 1, chunkEnd)
      : chunkText(extractedText, Math.max(MIN_CHUNKS, Math.min(topic.estimatedWeeks * 7, MAX_CHUNKS)));
    // Réindexe les chunks de 1..N pour ce thème afin que les dayNumber soient 1..N
    const chunks = rawChunks.map((c, idx) => ({ content: c.content, index: idx + 1 }));
    if (chunks.length === 0) {
      return NextResponse.json({ error: 'Le texte fourni est vide.' }, { status: 422 });
    }

    const job = await prisma.ingestJob.create({
      data: {
        status: mode === 'step' ? 'RUNNING' : 'PENDING',
        bookTitle: title,
        topicName: topic.name,
        totalChunks: chunks.length,
        ownerId,
      },
    });

    // Mode pas-à-pas piloté par le client : prépare le BookReference, le Quiz
    // et le plan pédagogique en quelques secondes, puis renvoie les extraits au
    // client qui appellera PUT /api/admin/ingest-pdf extrait par extrait.
    if (mode === 'step') {
      const ai = new GoogleGenAI({ apiKey });
      const [plan, { bookId, quizId }] = await Promise.all([
        generatePlan(ai, chunks, title, author, topic.maxDifficultyLevel),
        ensureBookAndQuiz({ bookId: bookIdParam, title, author, topicId, ownerId }),
      ]);
      const planEntries = plan ? Array.from(plan.values()) : [];

      await prisma.ingestJob.update({
        where: { id: job.id },
        data: {
          status: 'RUNNING',
          message: plan ? 'Planification prête — génération extrait par extrait…' : 'Génération extrait par extrait…',
        },
      });

      return NextResponse.json({
        success: true,
        mode: 'step',
        jobId: job.id,
        bookId,
        quizId,
        maxDifficultyLevel: topic.maxDifficultyLevel,
        totalChunks: chunks.length,
        chunks,
        plan: planEntries,
      });
    }

    after(() =>
      processIngestJob(job.id, {
        topicId,
        bookId: bookIdParam,
        title,
        author,
        apiKey,
        chunks,
        maxDifficultyLevel: topic.maxDifficultyLevel,
        ownerId,
      })
    );

    return NextResponse.json({ success: true, jobId: job.id, totalChunks: chunks.length });
  } catch (error) {
    console.error('Error in PDF ingestion:', error);
    return NextResponse.json({ error: 'Échec du traitement du PDF ou de la génération IA.' }, { status: 500 });
  }
}

/**
 * Exécute la génération et la sauvegarde immédiate en base d'UN SEUL extrait
 * (chunk). Chaque requête dure ~8 à 15s, évitant tout timeout Serverless même
 * sur le plan gratuit de Vercel (60s max).
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      jobId,
      bookId,
      quizId,
      topicId,
      title = 'Livre sans titre',
      author = 'Auteur inconnu',
      maxDifficultyLevel = 3,
      totalChunks = 1,
      chunk,
      plan = [],
      prevGenerated,
      isLastChunk = false,
      apiKey: bodyApiKey,
    } = body as {
      jobId: string;
      bookId: string;
      quizId: string;
      topicId: string;
      title?: string;
      author?: string;
      maxDifficultyLevel?: number;
      totalChunks?: number;
      chunk: { content: string; index: number };
      plan?: PlanEntry[];
      prevGenerated?: { title: string; concepts: string[] };
      isLastChunk?: boolean;
      apiKey?: string;
    };

    const apiKey = bodyApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Clé API Gemini manquante.' }, { status: 400 });
    }
    if (!jobId || !bookId || !quizId || !topicId || !chunk?.content) {
      return NextResponse.json({ error: "Paramètres d'extrait incomplets." }, { status: 400 });
    }

    // Le client renvoie jobId/topicId/quizId/bookId à chaque extrait : on
    // vérifie qu'ils appartiennent bien au profil connecté et vont ensemble.
    const session = await getSessionContext();
    const [job, stepTopic, quiz, book] = await Promise.all([
      prisma.ingestJob.findUnique({ where: { id: jobId }, select: { ownerId: true } }),
      prisma.topic.findUnique({ where: { id: topicId }, select: { ownerId: true } }),
      prisma.quiz.findUnique({ where: { id: quizId }, select: { topicId: true } }),
      prisma.bookReference.findUnique({ where: { id: bookId }, select: { ownerId: true } }),
    ]);
    if (!job || !stepTopic || !quiz || !book) {
      return NextResponse.json({ error: 'Génération introuvable.' }, { status: 404 });
    }
    if (
      !canWrite(session, job.ownerId) ||
      !canWrite(session, stepTopic.ownerId) ||
      !canWrite(session, book.ownerId) ||
      quiz.topicId !== topicId
    ) {
      return NextResponse.json({ error: 'Accès refusé à cette génération.' }, { status: 403 });
    }

    const planMap = new Map<number, PlanEntry>();
    for (const p of Array.isArray(plan) ? plan : []) {
      if (p && typeof p.dayNumber === 'number') planMap.set(p.dayNumber, p);
    }
    const planOverview = formatPlanOverview(Array.from(planMap.values()));
    const planEntry = planMap.get(chunk.index);
    const difficultyLevel =
      planEntry?.difficultyLevel ??
      Math.max(1, Math.min(maxDifficultyLevel, Math.ceil((chunk.index / Math.max(1, totalChunks)) * maxDifficultyLevel)));
    const context = {
      current: planEntry,
      prev: planMap.get(chunk.index - 1),
      next: planMap.get(chunk.index + 1),
    };

    const ai = new GoogleGenAI({ apiKey });
    let lessonsSaved = 0;
    let questionsSaved = 0;
    let nextPrevGenerated = prevGenerated;
    let chunkError: string | null = null;

    try {
      const response = await ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: lessonPrompt(chunk, title, author, totalChunks, difficultyLevel, context, planOverview, prevGenerated),
      });
      const { lessons, quizQuestions } = parseAiJson(response.text || '');
      const saved = await persistChunkOutput({
        topicId,
        bookId,
        quizId,
        title,
        dayNumber: chunk.index,
        difficultyLevel,
        lessons,
        quizQuestions,
      });
      lessonsSaved = saved.lessonsSaved;
      questionsSaved = saved.questionsSaved;

      const theoryLesson = lessons.find((l) => (l.keyConcepts || []).length > 0);
      if (theoryLesson) {
        nextPrevGenerated = {
          title: theoryLesson.title,
          concepts: (theoryLesson.keyConcepts || []).filter((c) => typeof c === 'string'),
        };
      }
    } catch (err) {
      chunkError = err instanceof Error ? err.message : 'Erreur IA sur cet extrait';
      console.error(`[ingest-pdf PUT] Échec sur l'extrait ${chunk.index}/${totalChunks} :`, err);
    }

    const currentJob = await prisma.ingestJob.findUnique({ where: { id: jobId } });
    const newLessonsTotal = (currentJob?.lessonsCreated || 0) + lessonsSaved;
    const newQuestionsTotal = (currentJob?.questionsCreated || 0) + questionsSaved;
    const processedChunks = Math.max(currentJob?.processedChunks || 0, chunk.index);

    const isDone = isLastChunk || processedChunks >= totalChunks;
    const finalStatus = isDone ? (newLessonsTotal > 0 ? 'DONE' : 'ERROR') : 'RUNNING';
    const message = isDone
      ? newLessonsTotal > 0
        ? `${newLessonsTotal} leçon(s) et ${newQuestionsTotal} question(s) créées.`
        : "La génération IA a échoué pour tous les extraits."
      : `Extrait ${processedChunks}/${totalChunks} traité…`;

    const updatedJob = await prisma.ingestJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        processedChunks,
        lessonsCreated: newLessonsTotal,
        questionsCreated: newQuestionsTotal,
        message,
      },
    });

    return NextResponse.json({
      success: !chunkError,
      chunkError,
      lessonsAdded: lessonsSaved,
      questionsAdded: questionsSaved,
      prevGenerated: nextPrevGenerated,
      job: updatedJob,
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/ingest-pdf:', error);
    return NextResponse.json({ error: "Échec du traitement de l'extrait." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  const session = await getSessionContext();
  if (!jobId) {
    const jobs = await prisma.ingestJob.findMany({
      where: session.isAdmin ? undefined : { ownerId: session.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json({ jobs });
  }
  const job = await prisma.ingestJob.findUnique({ where: { id: jobId } });
  if (!job || !canWrite(session, job.ownerId)) {
    return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 });
  }
  return NextResponse.json(job);
}
