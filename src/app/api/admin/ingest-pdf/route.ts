import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenAI } from '@google/genai';

const CHUNK_SIZE = 14_000;
const MIN_CHUNKS = 6;
const MAX_CHUNKS = 15;
const LESSONS_PER_CHUNK = 2;
const QUIZ_PASSING_SCORE = 80;

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

function chunkText(text: string, maxChunks: number): { content: string; index: number }[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const chunks: { content: string; index: number }[] = [];
  for (let i = 0; i < clean.length && chunks.length < maxChunks; i += CHUNK_SIZE) {
    let end = Math.min(i + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      const lastStop = clean.lastIndexOf('. ', end);
      if (lastStop > i + CHUNK_SIZE * 0.5) end = lastStop + 1;
    }
    chunks.push({ content: clean.slice(i, end), index: chunks.length + 1 });
  }
  return chunks;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(buffer);
    const text = pdfData?.text || '';
    if (text.trim().length < 500 && buffer.length > 1024 * 1024) {
      console.warn('[ingest-pdf] Texte extrait quasi vide pour un gros fichier : PDF probablement scanné (images).');
    }
    return text;
  } catch (err) {
    console.warn('PDF parsing fallback to raw text extraction:', err);
    const raw = buffer.toString('utf8');
    return /[a-zA-Zàâçéèêëîïôùû]{4,}[\s.]/.test(raw.slice(0, 2000))
      ? raw
      : '';
  }
}

function lessonPrompt(chunk: { content: string; index: number }, title: string, author: string, totalChunks: number, difficultyLevel: number): string {
  const dayNumber = chunk.index;
  const secondSession = dayNumber % 2 === 0 ? 'EVENING' : 'MORNING';
  const firstSession = secondSession === 'MORNING' ? 'EVENING' : 'MORNING';
  return `Tu es un expert pédagogique en ingénierie informatique.
À partir de l'extrait ${chunk.index}/${totalChunks} du livre "${title}" par ${author} :
---
${chunk.content}
---

Génère exactement 2 leçons pédagogiques complètes correspondant au JOUR ${dayNumber} du cursus :
- Leçon 1 : session de type ${firstSession} (théorie).
- Leçon 2 : session de type ${secondSession} (pratique / exercices d'application).
- Rédige en Français de haute qualité.
- TOUS les termes techniques doivent impérativement être suivis de leur terme d'origine en Anglais entre parenthèses. Ex : "Le protocole de transport (Transport Layer)".
- Inclus les citations précises du livre (chapitre et pages si identifiables).
- Niveau de difficulté cible : ${difficultyLevel}/5.

Réponds STRICTEMENT au format JSON valide selon ce schéma :
{
  "lessons": [
    {
      "title": "Titre de la leçon",
      "sessionType": "${firstSession}",
      "contentMd": "# Titre\\n\\nContenu rédigé...",
      "chapterCitation": "Chapitre X, pp. Y-Z",
      "keyConcepts": ["Concept 1 (English 1)", "Concept 2 (English 2)"]
    },
    {
      "title": "Titre de la leçon pratique",
      "sessionType": "${secondSession}",
      "contentMd": "# Pratique\\n\\nExercice...",
      "chapterCitation": "Chapitre X, pp. Y-Z",
      "keyConcepts": ["Concept A (English A)"]
    }
  ],
  "quizQuestions": [
    {
      "questionText": "Question sur le contenu de CET extrait",
      "options": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
      "correctAnswer": "Réponse A",
      "explanation": "Pourquoi cette réponse est correcte"
    }
  ]
}
Génère entre 2 et 3 quizQuestions couvrant uniquement le contenu de cet extrait.`;
}

function parseAiJson(responseText: string): { lessons: GeneratedLesson[]; quizQuestions: GeneratedQuestion[] } {
  const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(cleanJson);
  return {
    lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
    quizQuestions: Array.isArray(parsed.quizQuestions) ? parsed.quizQuestions : [],
  };
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
      data: { status: 'RUNNING', totalChunks: chunks.length },
    });

    const ai = new GoogleGenAI({ apiKey });

    const allLessons: (GeneratedLesson & { dayNumber: number; difficultyLevel: number })[] = [];
    const allQuestions: GeneratedQuestion[] = [];

    for (const chunk of chunks) {
      const difficultyLevel = Math.max(1, Math.min(maxDifficultyLevel, Math.ceil((chunk.index / chunks.length) * maxDifficultyLevel)));
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: lessonPrompt(chunk, title, author, chunks.length, difficultyLevel),
        });
        const { lessons, quizQuestions } = parseAiJson(response.text || '');
        for (let i = 0; i < Math.min(lessons.length, LESSONS_PER_CHUNK); i++) {
          allLessons.push({ ...lessons[i], dayNumber: chunk.index, difficultyLevel });
        }
        allQuestions.push(...quizQuestions);
      } catch (err) {
        console.error(`[ingest-pdf] Échec de génération pour l'extrait ${chunk.index}/${chunks.length} :`, err);
      }
      await prisma.ingestJob.update({
        where: { id: jobId },
        data: { processedChunks: chunk.index, lessonsCreated: allLessons.length, questionsCreated: allQuestions.length },
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
          `${allLessons.length} leçons et ${allQuestions.length} questions créées. ` +
          (allLessons.length < chunks.length * LESSONS_PER_CHUNK
            ? `${chunks.length - allLessons.length / LESSONS_PER_CHUNK} extrait(s) ont échoué et peuvent être relancés.`
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
    const title = (formData.get('title') as string) || 'Livre sans titre';
    const author = (formData.get('author') as string) || 'Auteur inconnu';
    const domainId = formData.get('domainId') as string;
    const topicId = formData.get('topicId') as string;
    const apiKey = (formData.get('apiKey') as string) || process.env.GEMINI_API_KEY;

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
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
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

    // Volume aligné sur la durée prévue du thème : 2 leçons/jour, ~7 jours/semaine,
    // plafonné à MAX_CHUNKS pour maîtriser le coût et la durée de génération.
    const maxChunks = Math.max(MIN_CHUNKS, Math.min(topic.estimatedWeeks * 7, MAX_CHUNKS));
    const chunks = chunkText(extractedText, maxChunks);
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
