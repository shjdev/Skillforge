import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenAI } from '@google/genai';
import { chunkText, extractPdfText, fetchBlobBuffer, BASE_CHUNKS, PLAN_OVERVIEW_CHARS } from '@/lib/ingestion';

// Cf. analyze-book/route.ts : les gros ouvrages arrivent via une URL Blob
// (non limitée à 4,5 Mo) et l'extraction + le découpage peuvent prendre du
// temps avant que le job d'arrière-plan ne démarre.
export const maxDuration = 60;

const MIN_CHUNKS = 6;
const MAX_CHUNKS = 15;
const LESSONS_PER_CHUNK = 2;
const QUIZ_PASSING_SCORE = 80;
const GENERATION_MODEL = 'gemini-3.6-flash';

interface GeneratedLesson {
  title: string;
  sessionType: string;
  contentMd: string;
  chapterCitation: string;
  keyConcepts: string[];
}
interface GeneratedQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}
interface PlanEntry {
  dayNumber: number;
  title: string;
  objective: string;
  difficultyLevel: number;
}

/**
 * Prompt for the planning pass: reads a short overview of every chunk (in book
 * order) and returns one syllabus entry per chunk, so that difficulty and
 * subject progression are decided by reading the WHOLE book, not by a blind
 * per-chunk guess. This is what gives the per-day generation calls below a
 * shared sense of "what came before / what's next" instead of running in
 * total isolation from each other.
 */
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

function parseAiJson(responseText: string): { lessons: GeneratedLesson[]; quizQuestions: GeneratedQuestion[] } {
  const parsed = JSON.parse(stripJsonFence(responseText));
  return {
    lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
    quizQuestions: Array.isArray(parsed.quizQuestions) ? parsed.quizQuestions : [],
  };
}

/**
 * Runs the planning pass and returns a syllabus keyed by chunk/day number.
 * Returns null (rather than throwing) on any failure so the caller can fall
 * back to independent per-chunk generation instead of failing the whole job.
 */
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

async function processIngestJob(jobId: string, params: {
  topicId: string;
  title: string;
  author: string;
  apiKey: string;
  chunks: { content: string; index: number }[];
  maxDifficultyLevel: number;
}) {
  const { topicId, title, author, apiKey, chunks, maxDifficultyLevel } = params;
  try {
    await prisma.ingestJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', totalChunks: chunks.length, message: 'Planification du cursus…' },
    });

    const ai = new GoogleGenAI({ apiKey });
    const plan = await generatePlan(ai, chunks, title, author, maxDifficultyLevel);

    // Vue d'ensemble du cursus : chaque appel de génération voit l'arc complet.
    const planOverview = plan
      ? Array.from(plan.values())
          .sort((a, b) => a.dayNumber - b.dayNumber)
          .map((e) => `- Jour ${e.dayNumber} : ${e.title}${e.objective ? ` (${e.objective})` : ''}`)
          .join('\n')
      : '';

    const allLessons: (GeneratedLesson & { dayNumber: number; difficultyLevel: number })[] = [];
    const allQuestions: GeneratedQuestion[] = [];
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
        for (let i = 0; i < Math.min(lessons.length, LESSONS_PER_CHUNK); i++) {
          allLessons.push({ ...lessons[i], dayNumber: chunk.index, difficultyLevel });
        }
        allQuestions.push(...quizQuestions);

        // Continuité réelle : la génération du jour suivant s'appuiera sur ce qui
        // vient d'être produit (et pas seulement sur le plan théorique).
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
          lessonsCreated: allLessons.length,
          questionsCreated: allQuestions.length,
          message: plan ? 'Génération selon le plan de cours…' : 'Génération (sans plan — extraits traités indépendamment)…',
        },
      });
    }

    if (allLessons.length === 0) {
      await prisma.ingestJob.update({
        where: { id: jobId },
        data: { status: 'ERROR', message: "La génération IA a échoué pour tous les extraits. Vérifiez la clé API et réessayez." },
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const bookRef = await tx.bookReference.create({
        data: {
          title,
          author,
          description: `Ouvrage ingéré via Console Admin pour le topic ${topicId}`,
        },
      });

      for (const lesson of allLessons) {
        await tx.lesson.create({
          data: {
            topicId,
            title: lesson.title,
            contentMd: lesson.contentMd,
            dayNumber: lesson.dayNumber,
            sessionType: ['MORNING', 'EVENING', 'FULL_DAY'].includes(lesson.sessionType)
              ? lesson.sessionType
              : 'FULL_DAY',
            difficultyLevel: lesson.difficultyLevel,
            durationMinutes: 30,
            keyConcepts: JSON.stringify(lesson.keyConcepts || []),
            contentSource: 'ai',
            bookReferenceId: bookRef.id,
            chapterCitation: lesson.chapterCitation || `Extrait du livre « ${title} »`,
          },
        });
      }

      if (allQuestions.length > 0) {
        const existingQuiz = await tx.quiz.findFirst({
          where: { topicId, quizType: 'WEEKLY' },
          include: { questions: true },
        });
        let targetQuizId: string;
        if (existingQuiz) {
          targetQuizId = existingQuiz.id;
        } else {
          const quiz = await tx.quiz.create({
            data: {
              topicId,
              title: `Quiz de validation — ${title}`,
              difficultyLevel: 1,
              passingScore: QUIZ_PASSING_SCORE,
              quizType: 'WEEKLY',
            },
          });
          targetQuizId = quiz.id;
        }
        for (const q of allQuestions) {
          if (!Array.isArray(q.options) || q.options.length < 2 || !q.correctAnswer) continue;
          await tx.quizQuestion.create({
            data: {
              quizId: targetQuizId,
              questionText: q.questionText,
              options: JSON.stringify(q.options),
              correctAnswer: q.correctAnswer,
              explanation: q.explanation || '',
              points: 20,
              questionType: 'MCQ',
            },
          });
        }
      }
    });

    await prisma.ingestJob.update({
      where: { id: jobId },
      data: {
        status: 'DONE',
        bookTitle: title,
        lessonsCreated: allLessons.length,
        questionsCreated: allQuestions.length,
        message:
          `${allLessons.length} leçons et ${allQuestions.length} questions créées` +
          (plan ? ' (avec plan de cursus cohérent).' : ' (plan indisponible — extraits traités indépendamment).') +
          (allLessons.length < chunks.length * LESSONS_PER_CHUNK
            ? ` ${chunks.length - allLessons.length / LESSONS_PER_CHUNK} extrait(s) ont échoué et peuvent être relancés.`
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
    const apiKey = (formData.get('apiKey') as string) || process.env.GEMINI_API_KEY;
    // Tranche d'extraits (import automatique multi-thèmes) : bornes 1-based incluses.
    const chunkStart = parseInt(formData.get('chunkStart') as string) || 0;
    const chunkEnd = parseInt(formData.get('chunkEnd') as string) || 0;
    const hasChunkRange = chunkStart >= 1 && chunkEnd >= chunkStart;

    if (!domainId || !topicId) {
      return NextResponse.json({ error: 'Le domaine et le topic sont requis' }, { status: 400 });
    }

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      select: { id: true, name: true, maxDifficultyLevel: true, estimatedWeeks: true },
    });
    if (!topic) {
      return NextResponse.json({ error: 'Topic introuvable' }, { status: 404 });
    }

    // Purge des livres orphelins (échecs d'ingestion antérieurs : aucune leçon liée)
    const purged = await prisma.bookReference.deleteMany({
      where: { lessons: { none: {} } },
    });
    if (purged.count > 0) {
      console.log(`[ingest-pdf] ${purged.count} livre(s) orphelin(s) purgé(s).`);
    }

    let extractedText = '';
    if (file || fileUrl) {
      const buffer = file ? Buffer.from(await file.arrayBuffer()) : await fetchBlobBuffer(fileUrl as string);
      extractedText = await extractPdfText(buffer);
      if (!extractedText.trim()) {
        return NextResponse.json(
          { error: "Aucun texte exploitable n'a pu être extrait de ce fichier (PDF scanné ou corrompu ?)." },
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
          description: `Ouvrage ingéré via Console Admin pour le topic ${topic.name}`,
        },
      });
      return NextResponse.json({
        success: true,
        bookId: bookRef.id,
        message: 'Livre ajouté à la base. (Ajoutez une clé API Gemini pour la génération automatique AI).',
      });
    }

    // Deux modes de découpage :
    // - tranche explicite (import automatique) : découpage de référence sur
    //   BASE_CHUNKS pour que les bornes correspondent à celles de l'analyse ;
    // - sinon volume aligné sur la durée prévue du thème (mode manuel).
    const chunks = hasChunkRange
      ? chunkText(extractedText, BASE_CHUNKS).slice(chunkStart - 1, chunkEnd)
      : chunkText(extractedText, Math.max(MIN_CHUNKS, Math.min(topic.estimatedWeeks * 7, MAX_CHUNKS)));
    if (chunks.length === 0) {
      return NextResponse.json({ error: 'Le texte fourni est vide.' }, { status: 422 });
    }

    const job = await prisma.ingestJob.create({
      data: {
        status: 'PENDING',
        bookTitle: title,
        topicName: topic.name,
        totalChunks: chunks.length,
      },
    });

    // Traitement en arrière-plan : le client suit la progression via GET ?jobId=
    processIngestJob(job.id, {
      topicId,
      title,
      author,
      apiKey,
      chunks,
      maxDifficultyLevel: topic.maxDifficultyLevel,
    }).catch(() => {});

    return NextResponse.json({ success: true, jobId: job.id, totalChunks: chunks.length });
  } catch (error) {
    console.error('Error in PDF ingestion:', error);
    return NextResponse.json({ error: 'Échec du traitement du PDF ou de la génération IA.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  if (!jobId) {
    const jobs = await prisma.ingestJob.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    return NextResponse.json({ jobs });
  }
  const job = await prisma.ingestJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 });
  }
  return NextResponse.json(job);
}
