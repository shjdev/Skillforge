'use client';

import { useSyncExternalStore } from 'react';
import { PERSONAL_KEY_STORAGE, readPersonalKey } from '@/lib/import/upload-client';

const CHANGE_EVENT = 'sf-personal-key-change';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Clé Gemini personnelle de ce navigateur (null côté serveur ou si absente). */
export function usePersonalKey(): string | null {
  return useSyncExternalStore(subscribe, readPersonalKey, () => null);
}

/** Enregistre ou retire la clé ; renvoie false si le stockage est bloqué. */
export function storePersonalKey(key: string | null): boolean {
  try {
    if (key) localStorage.setItem(PERSONAL_KEY_STORAGE, key);
    else localStorage.removeItem(PERSONAL_KEY_STORAGE);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}
