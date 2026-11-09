'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Notice, Skeleton } from '@/components/ui/feedback';
import { fetchJson } from '@/lib/api';
import { toErrorMessage } from '@/lib/errors';
import { formatDuration } from '@/lib/format';
import { LessonProse } from './LessonProse';
import { SESSION_LABEL } from './DayList';

interface Lesson {
  id: string;
  title: string;
  contentMd: string;
  dayNumber: number;
  sessionType: string;
  difficultyLevel: number;
  durationMinutes: number;
  keyConcepts: string[];
  chapterCitation: string | null;
}

const LEVELS = ['', 'Débutant', 'Facile', 'Intermédiaire', 'Avancé', 'Expert'];

/** Une leçon à lire, puis à marquer comme faite. */
export function LessonPanel({
  lessonId,
  done,
  canComplete,
  completing,
  onComplete,
  onNext,
}: {
  lessonId: string;
  done: boolean;
  canComplete: boolean;
  completing: boolean;
  onComplete: () => void;
  onNext: (() => void) | null;
}) {
  const query = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => fetchJson<{ lesson: Lesson }>(`/api/lessons/${lessonId}`).then((r) => r.lesson),
    staleTime: Infinity,
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="mt-4 h-80 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <Notice tone="danger" title="Leçon indisponible" action={<Button size="sm" onClick={() => query.refetch()}>Réessayer</Button>}>
        {toErrorMessage(query.error)}
      </Notice>
    );
  }

  const lesson = query.data;
  return (
    <article>
      <p className="kicker mb-3">
        Jour {lesson.dayNumber} · {SESSION_LABEL[lesson.sessionType] ?? 'Leçon'}
      </p>
      <h1 className="font-serif text-3xl font-light leading-tight sm:text-4xl">{lesson.title}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-3">
        <Badge>{formatDuration(lesson.durationMinutes)}</Badge>
        <Badge>{LEVELS[lesson.difficultyLevel] ?? 'Intermédiaire'}</Badge>
        {lesson.chapterCitation && <span>Source : {lesson.chapterCitation}</span>}
      </div>

      <div className="mt-8">
        <LessonProse content={lesson.contentMd} />
      </div>

      {lesson.keyConcepts.length > 0 && (
        <section className="mt-10 rounded-lg border border-rule bg-paper-raised p-5">
          <h2 className="kicker mb-3">Notions clés</h2>
          <ul className="flex flex-wrap gap-2">
            {lesson.keyConcepts.map((c) => (
              <li key={c} className="rounded-sm bg-paper-sunken px-2 py-1 text-sm text-ink-2">
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 flex flex-col gap-3 border-t border-rule pt-6 sm:flex-row sm:items-center sm:justify-between">
        {done ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <Check className="size-4" aria-hidden /> Leçon faite
          </p>
        ) : canComplete ? (
          <Button variant="accent" size="lg" loading={completing} onClick={onComplete}>
            <Check className="size-4" aria-hidden /> J’ai terminé cette leçon
          </Button>
        ) : (
          <span />
        )}
        {onNext && (
          <Button variant="secondary" onClick={onNext}>
            Leçon suivante <ArrowRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </article>
  );
}
