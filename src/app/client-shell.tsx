'use client';

import React, { useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { QueryProvider } from '@/components/providers/query-provider';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';

export function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const setUserProfile = useAppStore((state) => state.setUserProfile);
  useNotificationScheduler();

  useEffect(() => {
    fetch('/api/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setUserProfile({
            id: data.id,
            name: data.name,
            sessionMode: data.sessionMode,
            morningTime: data.morningTime,
            eveningTime: data.eveningTime,
            singleSessionTime: data.singleSessionTime,
            currentActiveDomainId: data.currentActiveDomainId,
            currentActiveTopicId: data.currentActiveTopicId,
            totalXp: data.totalXp,
            currentStreak: data.currentStreak,
          });
        }
      })
      .catch((err) => console.error('Failed to sync profile:', err));
  }, [setUserProfile]);

  return <QueryProvider>{children}</QueryProvider>;
}
