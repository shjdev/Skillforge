'use client';

import React from 'react';
import { QueryProvider } from '@/components/providers/query-provider';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';
import { Toaster } from '@/components/ui/toast';

/** Rappels de séance dans l'onglet du navigateur (no-op dans Electron). */
function ReminderScheduler() {
  useNotificationScheduler();
  return null;
}

export function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <ReminderScheduler />
      <Toaster />
    </QueryProvider>
  );
}
