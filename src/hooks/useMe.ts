'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

export interface Me {
  userId: string;
  name: string;
  isAdmin: boolean;
  authEnabled: boolean;
  totalXp: number;
  currentStreak: number;
}

export const ME_QUERY_KEY = ['me'] as const;

/** Profil de la session courante (nom, rôle, points, série). */
export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => fetchJson<Me>('/api/me'),
    staleTime: 30_000,
  });
}
