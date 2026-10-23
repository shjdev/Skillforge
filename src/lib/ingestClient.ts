import { parseJsonResponse } from './errors';

export interface IngestStepPlanEntry {
  dayNumber: number;
  title: string;
  objective: string;
  difficultyLevel: number;
}

export interface IngestStepInitResponse {
  success: boolean;
  mode?: 'step';
  jobId?: string;
  bookId?: string;
  quizId?: string;
  maxDifficultyLevel?: number;
  totalChunks?: number;
  chunks?: { content: string; index: number }[];
  plan?: IngestStepPlanEntry[];
  message?: string;
}

export interface IngestChunkResponse {
  success: boolean;
  chunkError?: string | null;
  lessonsAdded: number;
  questionsAdded: number;
  prevGenerated?: { title: string; concepts: string[] };
  job: {
    id: string;
    status: string;
    processedChunks: number;
    totalChunks: number;
    lessonsCreated: number;
    questionsCreated: number;
    message?: string | null;
  };
}

/**
 * Orchestre la génération d'un thème extrait par extrait côté client :
 * 1. Appelle POST /api/admin/ingest-pdf avec mode="step" (planification + création BookReference/Quiz).
 * 2. Boucle sur chaque extrait via PUT /api/admin/ingest-pdf (~10s par extrait, sauvegarde immédiate en base).
 * 3. Réessaie automatiquement une fois un extrait en cas d'erreur transitoire.
 */
export async function runTopicStepIngestion(params: {
  fileUrl: string | null;
  title: string;
  author: string;
  domainId: string;
  topicId: string;
  chunkStart: number;
  chunkEnd: number;
  bookId?: string | null;
  personal?: boolean;
  apiKey?: string;
  onProgress?: (info: {
    processedChunks: number;
    totalChunks: number;
    lessonsCreated: number;
    questionsCreated: number;
  }) => void;
}): Promise<{
  bookId?: string;
  lessonsCreated: number;
  questionsCreated: number;
  status: 'DONE' | 'ERROR';
  message?: string | null;
}> {
  const fd = new FormData();
  if (params.fileUrl) fd.append('fileUrl', params.fileUrl);
  else fd.append('rawText', '');
  fd.append('title', params.title);
  fd.append('author', params.author);
  fd.append('domainId', params.domainId);
  fd.append('topicId', params.topicId);
  fd.append('chunkStart', String(params.chunkStart));
  fd.append('chunkEnd', String(params.chunkEnd));
  fd.append('mode', 'step');
  if (params.bookId) fd.append('bookId', params.bookId);
  if (params.personal) fd.append('personal', 'true');
  if (params.apiKey) fd.append('apiKey', params.apiKey);

  const initRes = await fetch('/api/admin/ingest-pdf', { method: 'POST', body: fd });
  const initData = await parseJsonResponse<IngestStepInitResponse>(initRes, "Erreur d'initialisation de la génération");

  if (!initData.jobId || !initData.chunks || initData.chunks.length === 0) {
    return {
      bookId: initData.bookId,
      lessonsCreated: 0,
      questionsCreated: 0,
      status: 'DONE',
      message: initData.message || 'Livre enregistré.',
    };
  }

  const {
    jobId,
    bookId = '',
    quizId = '',
    maxDifficultyLevel = 3,
    chunks,
    plan = [],
  } = initData;

  let prevGenerated: { title: string; concepts: string[] } | undefined;
  let lessonsCreated = 0;
  let questionsCreated = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isLastChunk = i === chunks.length - 1;

    let attempt = 0;
    let stepData: IngestChunkResponse | null = null;
    while (attempt < 2) {
      attempt += 1;
      const stepRes = await fetch('/api/admin/ingest-pdf', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          bookId,
          quizId,
          topicId: params.topicId,
          title: params.title,
          author: params.author,
          maxDifficultyLevel,
          totalChunks: chunks.length,
          chunk,
          plan,
          prevGenerated,
          isLastChunk,
          apiKey: params.apiKey || undefined,
        }),
      });
      stepData = await parseJsonResponse<IngestChunkResponse>(stepRes, `Erreur sur l'extrait ${chunk.index}`);
      if (stepData.success || attempt >= 2) break;
    }

    if (stepData) {
      prevGenerated = stepData.prevGenerated ?? prevGenerated;
      lessonsCreated = stepData.job.lessonsCreated;
      questionsCreated = stepData.job.questionsCreated;
      params.onProgress?.({
        processedChunks: stepData.job.processedChunks,
        totalChunks: chunks.length,
        lessonsCreated,
        questionsCreated,
      });
    }
  }

  return {
    bookId,
    lessonsCreated,
    questionsCreated,
    status: lessonsCreated > 0 ? 'DONE' : 'ERROR',
    message:
      lessonsCreated > 0
        ? `${lessonsCreated} leçon(s) et ${questionsCreated} question(s) créées.`
        : 'Aucune leçon générée sur ce thème.',
  };
}
