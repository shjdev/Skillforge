'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ListOrdered } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge, Notice, ProgressBar, Skeleton } from '@/components/ui/feedback';
import { toast } from '@/components/ui/toast';
import { fetchJson } from '@/lib/api';
import { toErrorMessage } from '@/lib/errors';
import type { QuizResult, TopicView } from '@/lib/learn';
import { DayList, type Selection } from './DayList';
import { LessonPanel } from './LessonPanel';
import { QuizPanel } from './QuizPanel';

export function LearnView({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const topicKey = ['topic', slug];
  const query = useQuery({ queryKey: topicKey, queryFn: () => fetchJson<TopicView>(`/api/topics/${slug}`) });
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [showOutline, setShowOutline] = React.useState(false);

  const refreshAround = () => {
    queryClient.invalidateQueries({ queryKey: topicKey });
    queryClient.invalidateQueries({ queryKey: ['me'] });
    queryClient.invalidateQueries({ queryKey: ['books'] });
    queryClient.invalidateQueries({ queryKey: ['today'] });
  };

  const complete = useMutation({
    mutationFn: (lessonId: string) =>
      fetchJson<{ xpAwarded: number; nextLessonId: string | null; allDone: boolean }>(`/api/lessons/${lessonId}/complete`, {
        method: 'POST',
      }),
    onSuccess: (res) => {
      if (res.xpAwarded) toast.success(`Leçon faite : +${res.xpAwarded} points.`);
      refreshAround();
      setSelection(res.nextLessonId ? { kind: 'lesson', id: res.nextLessonId } : { kind: 'quiz' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (err) => toast.error(toErrorMessage(err)),
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <Notice tone="danger" title="Thème indisponible" action={<ButtonLink href="/library" size="sm">Bibliothèque</ButtonLink>}>
        {toErrorMessage(query.error)}
      </Notice>
    );
  }

  const view = query.data;
  if (view.locked) {
    return (
      <Notice
        tone="warning"
        title="Un autre thème est en cours"
        action={<ButtonLink href={`/learn/${view.activeTopic.slug}`} size="sm">Continuer « {view.activeTopic.name} »</ButtonLink>}
      >
        Pour rester concentré, un seul thème est actif à la fois. Validez le quiz de « {view.activeTopic.name} » (
        {view.activeTopic.bookTitle}) avant de commencer « {view.topic.name} ».
      </Notice>
    );
  }

  const current: Selection =
    selection ?? (view.nextLessonId ? { kind: 'lesson', id: view.nextLessonId } : view.quiz?.available ? { kind: 'quiz' } : { kind: 'lesson', id: view.lessons[0]?.id });
  const doneCount = view.lessons.filter((l) => l.done).length;
  const completed = view.topic.status === 'COMPLETED';
  const index = current.kind === 'lesson' ? view.lessons.findIndex((l) => l.id === current.id) : -1;
  const lesson = index >= 0 ? view.lessons[index] : null;
  const nextLesson = index >= 0 ? view.lessons[index + 1] : undefined;

  const select = (s: Selection) => {
    setSelection(s);
    setShowOutline(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <Link href={`/library/${view.topic.book.id}`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {view.topic.book.title}
      </Link>

      <header className="mb-8 border-b border-rule pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="kicker">Thème</p>
          {completed && <Badge tone="success">Validé</Badge>}
        </div>
        <p className="mt-2 font-serif text-2xl leading-tight">{view.topic.name}</p>
        <div className="mt-4 flex items-center gap-4">
          <ProgressBar value={view.lessons.length ? (doneCount / view.lessons.length) * 100 : 0} tone={completed ? 'success' : 'accent'} label="Avancement du thème" className="max-w-xs" />
          <span className="shrink-0 font-mono text-sm text-ink-2">
            {doneCount}/{view.lessons.length} leçons
          </span>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <aside className="mb-8 lg:mb-0">
          <Button variant="secondary" className="w-full lg:hidden" aria-expanded={showOutline} onClick={() => setShowOutline((v) => !v)}>
            <ListOrdered className="size-4" aria-hidden /> {showOutline ? 'Masquer le sommaire' : 'Voir le sommaire'}
          </Button>
          <div className={showOutline ? 'mt-4 block' : 'hidden lg:sticky lg:top-8 lg:block'}>
            <DayList view={view} selection={current} onSelect={select} />
          </div>
        </aside>

        <div className="min-w-0">
          {current.kind === 'quiz' && view.quiz ? (
            <QuizPanel
              key={view.quiz.id}
              quizId={view.quiz.id}
              onSubmitted={(result: QuizResult) => {
                if (result.passed) toast.success('Thème validé !');
                refreshAround();
              }}
            />
          ) : lesson ? (
            <LessonPanel
              key={lesson.id}
              lessonId={lesson.id}
              done={lesson.done}
              canComplete={!completed}
              completing={complete.isPending}
              onComplete={() => complete.mutate(lesson.id)}
              onNext={nextLesson ? () => select({ kind: 'lesson', id: nextLesson.id }) : view.quiz?.available ? () => select({ kind: 'quiz' }) : null}
            />
          ) : (
            <Notice tone="info">Ce thème n’a pas encore de leçon.</Notice>
          )}
        </div>
      </div>
    </>
  );
}
