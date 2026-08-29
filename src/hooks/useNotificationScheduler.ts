'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { resolveDueReminder } from '@/lib/notifications';

const emptySubscribe = () => () => {};

/** Reads the current browser Notification permission without an effect. */
export function useNotificationPermission(): NotificationPermission | 'unsupported' {
  return useSyncExternalStore(
    emptySubscribe,
    () => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'),
    () => 'default'
  );
}

const CHECK_INTERVAL_MS = 20_000;
const FIRED_KEY_PREFIX = 'skillforge-reminder-fired-';

function localDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayKey(slot: string): string {
  return `${FIRED_KEY_PREFIX}${slot}-${localDateKey()}`;
}

function fireNotification(title: string, body: string) {
  if (typeof window === 'undefined') return;
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

/**
 * Client-side reminder scheduler for the browser tab. When running inside
 * the Electron shell, the main process schedules and fires reminders itself
 * (see electron/main.js + electron/scheduler.js) so it keeps working even
 * when the window is minimized to the tray — this hook stays a no-op there
 * to avoid firing the same reminder twice.
 */
export function useNotificationScheduler() {
  const userProfile = useAppStore((state) => state.userProfile);
  const profileRef = useRef(userProfile);

  useEffect(() => {
    profileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) return;

    const check = () => {
      const profile = profileRef.current;
      if (!profile) return;

      const firedKeys = new Set<string>();
      if (localStorage.getItem(todayKey('single'))) firedKeys.add('single');
      if (localStorage.getItem(todayKey('morning'))) firedKeys.add('morning');
      if (localStorage.getItem(todayKey('evening'))) firedKeys.add('evening');
      const morningDone = !!localStorage.getItem(todayKey('morning-completed'));

      const due = resolveDueReminder(profile, new Date(), firedKeys, morningDone);
      if (due) {
        localStorage.setItem(todayKey(due.key), '1');
        fireNotification(due.title, due.body);
      }
    };
    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);
}

export function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return Promise.resolve('unsupported');
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Promise.resolve(Notification.permission);
  }
  return Notification.requestPermission();
}
