'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { RotateCcw, Search } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/field';
import { fetchJson } from '@/lib/api';
import { toErrorMessage } from '@/lib/errors';
import { formatDate, plural } from '@/lib/format';
import type { RevisionView as Revision } from '@/lib/learn';
import { SESSION_LABEL } from '@/components/learn/DayList';

type Lesson = Revision['lessons'][number];

/** Leçons déjà faites, à relire, avec recherche dans leur contenu. */
export function RevisionView() {
  const router = useRouter();
  const urlQuery = useSearchParams().get('q') ?? '';
  const [input, setInput] = React.useState(urlQuery);

  // Met à jour l'adresse (et donc la recherche) après une courte pause de frappe.
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (input.trim() !== urlQuery) router.replace(input.trim() ? `/revision?q=${encodeURIComponent(input.trim())}` : '/revision');
    }, 300);
    return () => clearTimeout(t);
  }, [input, urlQuery, router]);

  const query = useQuery({
    queryKey: ['revision', urlQuery],
    queryFn: () => fetchJson<Revision>(`/api/revision${urlQuery ? `?q=${encodeURIComponent(urlQuery)}` : ''}`),
    placeholderData: keepPreviousData,
  });

  const groups = React.useMemo(() => {
    const map = new Map<string, { topic: Lesson['topic']; lessons: Lesson[] }>();
    for (const l of query.data?.lessons ?? []) {
      const g = map.get(l.topic.slug) ?? { topic: l.topic, lessons: [] };
      g.lessons.push(l);
      map.set(l.topic.slug, g);
    }
    return [...map.values()];
  }, [query.data]);

  return (
    <>
      <div className="relative mb-8">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input
          type="search"
          aria-label="Rechercher dans vos leçons"
          placeholder="Rechercher une notion, un mot…"
          className="pl-9"
          value={input}
          maxLength={100}
          onChange={(e) => setInput(e.target.value)}
        />
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-3" aria-busy>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : query.isError ? (
        <Notice tone="danger" title="Chargement impossible" action={<Button size="sm" onClick={() => query.refetch()}>Réessayer</Button>}>
          {toErrorMessage(query.error)}
        </Notice>
      ) : query.data.lessons.length === 0 ? (
        urlQuery ? (
          <p className="text-ink-2">Aucune leçon faite ne contient « {urlQuery} ».</p>
        ) : (
          <EmptyState icon={<RotateCcw />} title="Rien à réviser pour l’instant" action={<ButtonLink href="/dashboard" variant="accent">Faire ma leçon du jour</ButtonLink>}>
            Les leçons que vous terminez apparaissent ici, pour les relire quand vous voulez.
          </EmptyState>
        )
      ) : (
        <div className="flex flex-col gap-10" aria-live="polite">
          <p className="text-sm text-ink-3">
            {plural(query.data.lessons.length, 'leçon')}
            {urlQuery && ` contenant « ${urlQuery} »`}
          </p>
          {groups.map(({ topic, lessons }) => (
            <section key={topic.slug}>
              <h2 className="font-serif text-2xl leading-tight">{topic.name}</h2>
              <p className="mb-4 text-sm text-ink-3">{topic.bookTitle}</p>
              <ul className="flex flex-col gap-3">
                {lessons.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/learn/${topic.slug}?lesson=${l.id}`}
                      className="block rounded-lg border border-rule bg-paper-raised p-4 transition-colors hover:border-rule-strong focus-visible:border-ember focus-visible:outline-none"
                    >
                      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                        Jour {l.dayNumber} · {SESSION_LABEL[l.sessionType] ?? 'Leçon'}
                        {l.completedAt && ` · faite le ${formatDate(l.completedAt)}`}
                      </p>
                      <p className="mt-1 font-medium">{l.title}</p>
                      {l.snippet && <p className="mt-2 text-sm text-ink-2">{l.snippet}</p>}
                      {!l.snippet && l.concepts.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {l.concepts.map((c) => (
                            <li key={c} className="rounded-sm bg-paper-sunken px-1.5 py-0.5 text-xs text-ink-2">
                              {c}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
