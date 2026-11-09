'use client';

import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Notice, ProgressBar } from '@/components/ui/feedback';
import { plural } from '@/lib/format';
import { topicDays, type ImportJob } from './types';

/**
 * Avancement de la génération. La génération tourne tant que cette page est
 * ouverte ; en cas d'arrêt, elle reprend là où elle s'était arrêtée.
 */
export function GenerationStep({
  job,
  paused,
  error,
  onResume,
  onCancel,
}: {
  job: ImportJob;
  paused: boolean;
  error: string | null;
  onResume: () => void;
  onCancel: () => void;
}) {
  const { done, total } = job.progress;
  const pct = total ? (done / total) * 100 : 0;
  const topics = job.analysis?.topics ?? [];
  const currentTopic = job.current ? topics.findIndex((t) => job.current!.chunk >= t.chunkStart && job.current!.chunk <= t.chunkEnd) : -1;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <p className="font-serif text-2xl">{job.analysis?.title || job.fileName}</p>
            <p className="shrink-0 font-mono text-sm text-ink-2">
              {done}/{total} jours
            </p>
          </div>
          <ProgressBar value={pct} label="Avancement de la génération" />
          <p className="mt-3 text-sm text-ink-2" aria-live="polite">
            {paused
              ? 'Génération en pause.'
              : job.current && currentTopic >= 0
                ? `Rédaction du jour ${job.current.dayNumber} sur ${topicDays(topics[currentTopic])} — « ${topics[currentTopic].name} »…`
                : 'Préparation…'}
          </p>
          <p className="mt-1 text-sm text-ink-3">
            {plural(job.lessonsCreated, 'leçon créée', 'leçons créées')} · {plural(job.questionsCreated, 'question', 'questions')} de quiz
            {job.skipped > 0 && ` · ${plural(job.skipped, 'jour ignoré', 'jours ignorés')}`}
          </p>
        </CardBody>
      </Card>

      {error && (
        <Notice tone={paused ? 'danger' : 'warning'} title={paused ? 'La génération est en pause' : 'Nouvel essai en cours'} action={paused && <Button size="sm" onClick={onResume}>Reprendre</Button>}>
          {error}
        </Notice>
      )}

      {!error && (
        <Notice tone="info">
          Gardez cette page ouverte pendant la génération (environ une minute par jour). Si vous la fermez, la génération
          s’arrête et reprendra là où elle en était quand vous reviendrez. Les thèmes terminés sont déjà disponibles dans votre
          bibliothèque.
        </Notice>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel}>
          Arrêter l’import
        </Button>
        {job.bookId && (
          <ButtonLink href={`/library/${job.bookId}`} variant="secondary">
            Voir le livre
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
