'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Plus } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { useBooks } from '@/hooks/useBooks';
import { fetchJson } from '@/lib/api';
import { toErrorMessage } from '@/lib/errors';
import { plural } from '@/lib/format';
import { importHeaders } from '@/lib/import/upload-client';
import { cn } from '@/lib/utils';
import type { ImportsOverview } from '@/components/import/types';
import { BookCard } from './BookCard';

export function LibraryView() {
  const books = useBooks();
  const imports = useQuery({
    queryKey: ['imports'],
    queryFn: () => fetchJson<ImportsOverview>('/api/imports', { headers: importHeaders() }),
  });
  const [category, setCategory] = React.useState<string | null>(null);

  const toReview = imports.data?.jobs.filter((j) => j.status === 'REVIEW') ?? [];
  const list = books.data?.books ?? [];
  const categories = books.data?.categories ?? [];
  const shown = category ? list.filter((b) => b.category === category) : list;

  return (
    <>
      <PageHeader
        kicker="Bibliothèque"
        title="Vos livres"
        description={list.length ? `${plural(list.length, 'livre')}, chacun découpé en thèmes et en leçons quotidiennes.` : undefined}
        action={
          <ButtonLink href="/library/import" variant="accent">
            <Plus className="size-4" aria-hidden /> Importer un livre
          </ButtonLink>
        }
      />

      {toReview.map((job) => (
        <Notice
          key={job.id}
          tone="warning"
          title="Un import attend votre validation"
          className="mb-4"
          action={<ButtonLink href={`/library/import?job=${job.id}`} size="sm">Valider</ButtonLink>}
        >
          « {job.analysis?.title || job.fileName} » : vérifiez le plan proposé pour lancer la génération.
        </Notice>
      ))}

      {books.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : books.isError ? (
        <Notice tone="danger" title="Impossible de charger vos livres" action={<Button size="sm" onClick={() => books.refetch()}>Réessayer</Button>}>
          {toErrorMessage(books.error)}
        </Notice>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="Votre bibliothèque est vide"
          action={<ButtonLink href="/library/import" variant="accent">Importer mon premier livre</ButtonLink>}
        >
          Importez un livre ou un cours (PDF, TXT ou Markdown). SkillForge le découpe en thèmes, rédige une leçon par jour et
          prépare un quiz pour valider chaque thème.
        </EmptyState>
      ) : (
        <>
          {categories.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filtrer par catégorie">
              {[null, ...categories].map((c) => (
                <button
                  key={c ?? 'all'}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm transition-colors',
                    category === c ? 'border-ink bg-ink text-paper' : 'border-rule-strong text-ink-2 hover:border-ink-3',
                  )}
                >
                  {c ?? 'Toutes'}
                </button>
              ))}
            </div>
          )}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((book) => (
              <li key={book.id}>
                <BookCard book={book} />
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-ink-3">
            Un fichier à ajouter ?{' '}
            <Link href="/library/import" className="text-ember-strong underline-offset-2 hover:underline">
              Importer un autre livre
            </Link>
          </p>
        </>
      )}
    </>
  );
}
