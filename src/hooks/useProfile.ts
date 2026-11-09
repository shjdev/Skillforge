'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';
import type { ProfileView } from '@/lib/profile';

export const PROFILE_KEY = ['profile'] as const;

/** Réglages de l'utilisateur (nom, rythme, rappels). */
export function useProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: () => fetchJson<ProfileView>('/api/profile'), staleTime: 60_000 });
}
