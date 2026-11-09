'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Flame, Hourglass, Sparkles, Trophy } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState, Notice, ProgressBar, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { fetchJson } from '@/lib/api';
import { toErrorMessage } from '@/lib/errors';
import { formatDuration, formatPoints, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TodayView as Today } from '@/lib/learn';
import { SESSION_LABEL } from '@/components/learn/DayList';

const todayLabel = () => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export function TodayView() {
  const query = useQuery({ queryKey: ['today'], queryFn: () => fetchJson<Today>('/api/today') });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-14 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <Notice tone="danger" title="Chargement impossible" action={<Button size="sm" onClick={() => query.refetch()}>Réessayer</Button>}>
        {toErrorMessage(query.error)}
      </Notice>
    );
  }

  const t = query.data;
  const firstName = t.name.split(' ')[0] || 'à vous';

  return (
    <>
      <PageHeader kicker={todayLabel()} title={`Bonjour, ${firstName}`} />

      <dl className="mb-8 grid grid-cols-3 gap-3">
        <Stat icon={<Flame />} label="Série" value={plural(t.streak, 'jour')} />
        <Stat icon={<Sparkles />} label="Points" value={formatPoints(t.totalXp)} />
        <Stat icon={<BookOpen />} label="Aujourd’hui" value={plural(t.doneToday, 'leçon')} />
      </dl>

      {t.imports.map((job) => (
        <Notice
          key={job.id}
          tone={job.status === 'REVIEW' ? 'warning' : 'info'}
          className="mb-4"
          title={job.status === 'REVIEW' ? 'Un import attend votre validation' : `Génération en cours : ${job.done}/${job.total} jours`}
          action={<ButtonLink href={`/library/import?job=${job.id}`} size="sm">{job.status === 'REVIEW' ? 'Valider' : 'Suivre'}</ButtonLink>}
        >
          {job.title}
        </Notice>
      ))}

      {t.current ? (
        <CurrentTopic current={t.current} />
      ) : t.suggestions.length > 0 ? (
        <Card>
          <CardBody>
            <p className="kicker mb-2">Votre prochain thème</p>
            <h2 className="font-serif text-2xl">Choisissez ce que vous apprenez maintenant</h2>
            <p className="mt-1 text-ink-2">Un seul thème à la fois : il reste actif jusqu’à la réussite de son quiz.</p>
            <ul className="mt-6 divide-y divide-rule">
              {t.suggestions.map((s) => (
                <li key={s.slug} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-serif text-xl leading-tight">{s.name}</p>
                    <p className="text-sm text-ink-3">
                      {s.bookTitle} · {plural(s.days, 'jour')}
                    </p>
                  </div>
                  <ButtonLink href={`/learn/${s.slug}`} variant="accent" className="self-start sm:self-center">
                    Commencer
                  </ButtonLink>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : t.topicsInPreparation > 0 ? (
        <EmptyState icon={<Hourglass />} title="Votre premier thème est en préparation">
          Il sera disponible dès que ses leçons seront générées. Suivez l’avancement depuis la bibliothèque.
        </EmptyState>
      ) : t.booksCount > 0 ? (
        <EmptyState
          icon={<Trophy />}
          title="Tous vos thèmes sont validés"
          action={<ButtonLink href="/library/import" variant="accent">Importer un nouveau livre</ButtonLink>}
        >
          Bravo ! Importez un autre livre pour continuer à apprendre, ou révisez vos leçons.
        </EmptyState>
      ) : (
        <EmptyState
          icon={<BookOpen />}
          title="Commencez par importer un livre"
          action={<ButtonLink href="/library/import" variant="accent">Importer un livre</ButtonLink>}
        >
          SkillForge transforme votre livre ou votre cours en leçons quotidiennes, regroupées en thèmes et validées par des quiz.
        </EmptyState>
      )}

      <section className="mt-10" aria-labelledby="week-title">
        <h2 id="week-title" className="kicker mb-3 !text-ink-2">
          Vos 7 derniers jours
        </h2>
        <ol className="grid grid-cols-7 gap-2">
          {t.week.map((d, i) => {
            const date = new Date(d.date);
            return (
              <li
                key={d.date}
                className={cn(
                  'flex flex-col items-center rounded-md border py-2 text-center',
                  d.lessons > 0 ? 'border-ember/40 bg-ember-soft' : 'border-rule',
                  i === 6 && 'ring-1 ring-ink/20',
                )}
              >
                <span className="font-mono text-[11px] uppercase text-ink-3">{date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</span>
                <span className="font-serif text-xl">{d.lessons}</span>
                <span className="sr-only">{plural(d.lessons, 'leçon')} le {date.toLocaleDateString('fr-FR')}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-rule bg-paper-raised px-4 py-3">
      <dt className="flex items-center gap-1.5 text-sm text-ink-3 [&_svg]:size-4 [&_svg]:text-ember">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-serif text-2xl leading-tight">{value}</dd>
    </div>
  );
}

function CurrentTopic({ current }: { current: NonNullable<Today['current']> }) {
  const pct = current.totalLessons ? (current.doneLessons / current.totalLessons) * 100 : 0;
  const next = current.nextLesson;
  return (
    <Card>
      <CardBody>
        <p className="kicker mb-2">Votre thème en cours</p>
        <h2 className="font-serif text-3xl font-light leading-tight">{current.topic.name}</h2>
        <p className="mt-1 text-sm text-ink-3">{current.topic.bookTitle}</p>
        <div className="mt-4 flex items-center gap-4">
          <ProgressBar value={pct} label="Avancement du thème en cours" className="max-w-sm" />
          <span className="shrink-0 font-mono text-sm text-ink-2">
            {current.doneLessons}/{current.totalLessons} leçons
          </span>
        </div>

        <div className="mt-6 rounded-lg border border-rule bg-paper p-4 sm:p-5">
          {next ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                  Jour {next.dayNumber} sur {current.totalDays} · {SESSION_LABEL[next.sessionType] ?? 'Leçon'} · {formatDuration(next.durationMinutes)}
                </p>
                <p className="mt-1 font-serif text-xl leading-tight">{next.title}</p>
              </div>
              <ButtonLink href={`/learn/${current.topic.slug}`} variant="accent" size="lg" className="self-start sm:self-center">
                {current.doneLessons ? 'Reprendre' : 'Commencer'} <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-serif text-xl leading-tight">
                {current.quizReady ? 'Toutes les leçons sont faites : passez le quiz pour valider le thème.' : 'Toutes les leçons sont faites.'}
              </p>
              <ButtonLink href={`/learn/${current.topic.slug}`} variant="accent" size="lg" className="self-start sm:self-center">
                {current.quizReady ? 'Passer le quiz' : 'Ouvrir le thème'}
              </ButtonLink>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
