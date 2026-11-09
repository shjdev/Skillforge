'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';
import type { BookDetail, BookSummary } from '@/lib/library';

export const BOOKS_KEY = ['books'] as const;
export const bookKey = (id: string) => ['books', id] as const;

/** Livres de l'utilisateur (rafraîchis pendant qu'un import tourne). */
export function useBooks() {
  return useQuery({
    queryKey: BOOKS_KEY,
    queryFn: () => fetchJson<{ books: BookSummary[]; categories: string[] }>('/api/books'),
    refetchInterval: (q) => (q.state.data?.books.some((b) => b.import) ? 15_000 : false),
  });
}

export function useBook(id: string) {
  return useQuery({
    queryKey: bookKey(id),
    queryFn: () => fetchJson<{ book: BookDetail }>(`/api/books/${id}`).then((r) => r.book),
    refetchInterval: (q) => (q.state.data?.import ? 15_000 : false),
  });
}
