'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * Returns false during SSR/first client render and true after hydration.
 * Used to gate client-only values (e.g. persisted store state) without
 * triggering a setState-in-effect render cascade.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
