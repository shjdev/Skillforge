'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useAppStore } from '@/stores/useAppStore';

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
const FIRE_WINDOW_MIN = 20;
const FIRED_KEY_PREFIX = 'skillforge-reminder-fired-';

function localDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayKey(slot: string): string {
  return `${FIRED_KEY_PREFIX}${slot}-${localDateKey()}`;
}

/** Minutes since local midnight for a "HH:MM" string. */
function slotMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * True when the current local time falls inside the firing window of the slot
 * (slot time to slot time + FIRE_WINDOW_MIN). Tolerates the app being opened
 * a few minutes late instead of requiring an exact minute match.
 */
function isSlotDue(hhmm: string | undefined): boolean {
  if (!hhmm) return false;
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const start = slotMinutes(hhmm);
  return nowM >= start && nowM < start + FIRE_WINDOW_MIN;
}

function fireNotification(title: string, body: string) {
  if (typeof window === 'undefined') return;

  if (window.electronAPI?.isElectron) {
    window.electronAPI.sendNotification({ title, body });
    return;
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

/**
 * Client-side reminder scheduler. Since there is no real OS-level scheduling
 * without a packaged Electron shell, this polls the clock while the app tab
 * is open and fires a Web Notification (or the electronAPI bridge if present)
 * when a configured session time is reached. Each slot fires at most once/day
 * (tracked in localStorage) to avoid repeat pop-ups.
 */
export function useNotificationScheduler() {
  const userProfile = useAppStore((state) => state.userProfile);
  const profileRef = useRef(userProfile);

  useEffect(() => {
    profileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    const check = () => {
      const profile = profileRef.current;
      if (!profile) return;

      if (profile.sessionMode === 'ONE_SESSION') {
        if (isSlotDue(profile.singleSessionTime)) {
          const key = todayKey('single');
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, '1');
            fireNotification('SkillForge — Session du jour', 'C’est l’heure de votre session d’apprentissage !');
          }
        }
      } else {
        if (isSlotDue(profile.morningTime)) {
          const key = todayKey('morning');
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, '1');
            fireNotification('SkillForge — Session du matin', 'C’est l’heure de votre session du matin (30 min).');
          }
        }
        if (isSlotDue(profile.eveningTime)) {
          const key = todayKey('evening');
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, '1');
            const morningDone = !!localStorage.getItem(todayKey('morning-completed'));
            fireNotification(
              'SkillForge — Session du soir',
              morningDone
                ? 'C’est l’heure de votre session du soir (30 min).'
                : 'Session du soir : pensez à cumuler si vous avez manqué le matin (jusqu’à 60 min).'
            );
          }
        }
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
