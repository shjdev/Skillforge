// File des extraits à générer. Fonctions pures (testées).

/** Un extrait du livre à transformer en leçons pour un jour d'un thème. */
export interface QueueItem {
  topicId: string;
  /** Numéro de l'extrait dans le livre, à partir de 1. */
  chunk: number;
  /** Jour dans le thème, à partir de 1. */
  dayNumber: number;
}

/** Au-delà de ce nombre d'échecs consécutifs, l'extrait est ignoré. */
export const MAX_FAILURES_PER_CHUNK = 3;

/** Un jour par extrait, thème par thème, dans l'ordre du livre. */
export function buildQueue(topics: { id: string; chunkStart: number; chunkEnd: number }[]): QueueItem[] {
  const items: QueueItem[] = [];
  for (const topic of [...topics].sort((a, b) => a.chunkStart - b.chunkStart)) {
    for (let chunk = topic.chunkStart; chunk <= topic.chunkEnd; chunk++) {
      items.push({ topicId: topic.id, chunk, dayNumber: chunk - topic.chunkStart + 1 });
    }
  }
  return items;
}

/** Vrai si l'élément `cursor` est le dernier jour de son thème. */
export function isLastOfTopic(queue: QueueItem[], cursor: number): boolean {
  const item = queue[cursor];
  if (!item) return false;
  const next = queue[cursor + 1];
  return !next || next.topicId !== item.topicId;
}

/** Nombre de jours prévus pour un thème. */
export function topicDayCount(queue: QueueItem[], topicId: string): number {
  return queue.filter((q) => q.topicId === topicId).length;
}

/**
 * Après un échec sur l'extrait courant : on réessaie, ou on passe à la suite
 * au-delà de MAX_FAILURES_PER_CHUNK échecs.
 */
export function afterFailure(failures: number): { failures: number; skip: boolean } {
  const next = failures + 1;
  return next >= MAX_FAILURES_PER_CHUNK ? { failures: 0, skip: true } : { failures: next, skip: false };
}
