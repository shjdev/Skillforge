import Link from 'next/link';
import { Badge, ProgressBar } from '@/components/ui/feedback';
import { plural } from '@/lib/format';
import type { BookSummary } from '@/lib/library';

/** Carte d'un livre dans la bibliothèque : toute la carte mène au livre. */
export function BookCard({ book }: { book: BookSummary }) {
  const pct = book.totalLessons ? (book.doneLessons / book.totalLessons) * 100 : 0;
  const finished = book.totalLessons > 0 && book.doneLessons === book.totalLessons;

  return (
    <Link
      href={`/library/${book.id}`}
      className="group flex h-full flex-col rounded-lg border border-rule bg-paper-raised p-5 transition-colors hover:border-rule-strong focus-visible:border-ember focus-visible:outline-none"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="kicker truncate">{book.category ?? 'Sans catégorie'}</span>
        {book.import ? (
          <Badge tone="warning">
            En génération {book.import.done}/{book.import.total}
          </Badge>
        ) : finished ? (
          <Badge tone="success">Terminé</Badge>
        ) : null}
      </div>
      <h3 className="font-serif text-2xl leading-tight group-hover:text-ember-strong">{book.title}</h3>
      {book.author && <p className="mt-1 text-sm text-ink-2">{book.author}</p>}
      <div className="mt-auto pt-6">
        <p className="mb-2 flex justify-between gap-2 text-sm text-ink-3">
          <span>
            {plural(book.topicsCount, 'thème')} · {plural(book.totalLessons, 'leçon')}
          </span>
          <span className="font-mono">{Math.round(pct)} %</span>
        </p>
        <ProgressBar value={pct} tone={finished ? 'success' : 'accent'} label={`Avancement de « ${book.title} »`} />
      </div>
    </Link>
  );
}
