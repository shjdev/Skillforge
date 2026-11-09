// Formes renvoyées par /api/imports (voir serializeJob côté serveur).

export type ImportStatus = 'ANALYZING' | 'REVIEW' | 'GENERATING' | 'DONE' | 'ERROR' | 'CANCELLED';

export interface ImportTopic {
  name: string;
  description: string;
  chunkStart: number;
  chunkEnd: number;
  maxDifficultyLevel: number;
}

export interface ImportJob {
  id: string;
  status: ImportStatus;
  error: string | null;
  fileName: string;
  fileSize: number;
  bookId: string | null;
  analysis: {
    isTeachable: boolean;
    rejectionReason: string;
    title: string;
    author: string;
    summary: string;
    category: string;
    topics: ImportTopic[];
    totalDays: number;
  } | null;
  progress: { done: number; total: number };
  current: { topicId: string; chunk: number; dayNumber: number } | null;
  skipped: number;
  lessonsCreated: number;
  questionsCreated: number;
  createdAt: string;
  updatedAt: string;
}

export interface Quota {
  limit: number | null;
  used: number;
  remaining: number | null;
  allowed: boolean;
}

export interface ImportsOverview {
  jobs: ImportJob[];
  quota: Quota;
  serverKey: boolean;
}

export const topicDays = (t: ImportTopic) => t.chunkEnd - t.chunkStart + 1;
