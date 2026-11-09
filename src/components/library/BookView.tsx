'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Notice, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from '@/components/ui/toast';
import { BOOKS_KEY, bookKey, useBook } from '@/hooks/useBooks';
import { fetchJson } from '@/lib/api';
import { toErrorMessage } from '@/lib/errors';
import { formatDate, plural } from '@/lib/format';
import type { BookDetail } from '@/lib/library';
import { EditBookDialog, type BookFields } from './EditBookDialog';
import { TopicRow } from './TopicRow';

export function BookView({ bookId }: { bookId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useBook(bookId);
  const [editing, setEditing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <Notice tone="danger" title="Livre introuvable" action={<ButtonLink href="/library" size="sm">Bibliothèque</ButtonLink>}>
        {toErrorMessage(query.error)}
      </Notice>
    );
  }

  const book = query.data;
  const activeInBook = book.topics.find((t) => t.state === 'ACTIVE');
  const blockedBy = book.activeElsewhere ? `${book.activeElsewhere.name} (${book.activeElsewhere.bookTitle})` : activeInBook?.name ?? null;
  const totalLessons = book.topics.reduce((s, t) => s + t.totalLessons, 0);

  const save = async (values: BookFields) => {
    const res = await fetchJson<{ book: BookDetail }>(`/api/books/${bookId}`, { method: 'PATCH', json: values });
    queryClient.setQueryData(bookKey(bookId), res.book);
    queryClient.invalidateQueries({ queryKey: BOOKS_KEY, exact: true });
    toast.success('Livre mis à jour.');
  };

  const remove = async () => {
    await fetchJson(`/api/books/${bookId}`, { method: 'DELETE' });
    queryClient.removeQueries({ queryKey: bookKey(bookId) });
    await queryClient.invalidateQueries({ queryKey: BOOKS_KEY, exact: true });
    queryClient.invalidateQueries({ queryKey: ['me'] });
    toast.success('Livre supprimé.');
    router.push('/library');
  };

  return (
    <>
      <Link href="/library" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Bibliothèque
      </Link>
      <PageHeader
        kicker={book.category ?? 'Sans catégorie'}
        title={book.title}
        description={book.author ? `de ${book.author}` : undefined}
        action={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden /> Modifier
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(true)} aria-label="Supprimer le livre">
              <Trash2 className="size-4" aria-hidden /> Supprimer
            </Button>
          </>
        }
      />

      {book.import && (
        <Notice
          tone="warning"
          title={`Génération en cours : ${book.import.done}/${book.import.total} jours`}
          className="mb-6"
          action={<ButtonLink href={`/library/import?job=${book.import.jobId}`} size="sm">Suivre</ButtonLink>}
        >
          Les thèmes terminés sont déjà disponibles. Si la génération s’est arrêtée, ouvrez le suivi pour la reprendre.
        </Notice>
      )}

      {book.summary && <p className="mb-8 max-w-3xl font-serif text-lg leading-relaxed text-ink-2">{book.summary}</p>}

      <Card>
        <CardBody>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="kicker !text-ink-2">Le parcours</h2>
            <p className="text-sm text-ink-3">
              {plural(book.topics.length, 'thème')} · {plural(totalLessons, 'leçon')} · importé le {formatDate(book.createdAt)}
            </p>
          </div>
          {book.topics.length === 0 ? (
            <p className="text-ink-2">Aucun thème pour l’instant : ils apparaîtront au fil de la génération.</p>
          ) : (
            <ol className="divide-y divide-rule">
              {book.topics.map((topic) => (
                <TopicRow key={topic.id} topic={topic} blockedBy={topic.id === activeInBook?.id ? null : blockedBy} />
              ))}
            </ol>
          )}
        </CardBody>
      </Card>

      {editing && (
        <EditBookDialog
          open
          onOpenChange={setEditing}
          initial={{ title: book.title, author: book.author, category: book.category ?? '' }}
          onSave={save}
        />
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Supprimer ce livre ?"
        description={`« ${book.title} », ses ${plural(book.topics.length, 'thème')}, ${plural(totalLessons, 'leçon')}, quiz et votre avancement seront définitivement supprimés.`}
        onConfirm={remove}
      />
    </>
  );
}
