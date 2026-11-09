'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState, Notice, ProgressBar, Skeleton } from '@/components/ui/feedback';
import { fetchJson } from '@/lib/api';
import { toErrorMessage } from '@/lib/errors';
import { formatDuration, formatPoints } from '@/lib/format';
import type { StatsView as Stats } from '@/lib/stats';
import { ActivityChart } from './ActivityChart';

export function StatsView() {
  const query = useQuery({ queryKey: ['stats'], queryFn: () => fetchJson<Stats>('/api/stats') });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
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

  const s = query.data;
  if (s.totals.lessons === 0) {
    return (
      <EmptyState icon={<BarChart3 />} title="Pas encore de statistiques" action={<ButtonLink href="/dashboard" variant="accent">Faire ma première leçon</ButtonLink>}>
        Vos leçons, votre temps d’étude et vos thèmes validés s’afficheront ici.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Leçons faites" value={String(s.totals.lessons)} />
        <Tile label="Temps d’étude" value={formatDuration(s.totals.minutes)} />
        <Tile label="Thèmes validés" value={String(s.totals.topicsValidated)} />
        <Tile label="Points" value={formatPoints(s.totals.points)} />
      </dl>

      <Card>
        <CardBody>
          <ActivityChart days={s.daily} />
        </CardBody>
      </Card>

      {s.books.length > 0 && (
        <section aria-labelledby="books-progress">
          <h2 id="books-progress" className="kicker mb-3 !text-ink-2">
            Avancement par livre
          </h2>
          <ul className="flex flex-col divide-y divide-rule rounded-lg border border-rule bg-paper-raised">
            {s.books.map((b) => {
              const pct = b.totalLessons ? (b.doneLessons / b.totalLessons) * 100 : 0;
              return (
                <li key={b.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-6">
                  <Link href={`/library/${b.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-ember-strong">
                    {b.title}
                  </Link>
                  <ProgressBar value={pct} tone={pct === 100 ? 'success' : 'accent'} label={`Avancement de « ${b.title} »`} className="sm:max-w-48" />
                  <span className="shrink-0 font-mono text-sm text-ink-2 sm:w-24 sm:text-right">
                    {b.doneLessons}/{b.totalLessons}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-rule bg-paper-raised px-4 py-3">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="mt-1 font-serif text-3xl leading-tight">{value}</dd>
    </div>
  );
}
