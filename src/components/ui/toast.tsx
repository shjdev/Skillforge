'use client';

import * as React from 'react';
import { create } from 'zustand';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToastItem {
  id: number;
  tone: 'success' | 'danger';
  message: string;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (tone: ToastItem['tone'], message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (tone, message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, tone, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), tone === 'danger' ? 8000 : 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Notifications éphémères : une action réussie ou un échec n'est jamais silencieux. */
export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('danger', message),
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:right-6 md:left-auto md:items-end"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'danger' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-paper-raised px-4 py-3 text-sm shadow-raised animate-in fade-in-0 slide-in-from-bottom-2',
            t.tone === 'danger' ? 'border-danger/30' : 'border-success/30',
          )}
        >
          {t.tone === 'danger' ? (
            <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          )}
          <p className="flex-1 text-ink">{t.message}</p>
          <button onClick={() => dismiss(t.id)} className="text-ink-3 hover:text-ink" aria-label="Fermer">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
