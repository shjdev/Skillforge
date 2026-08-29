// Pure, testable helpers for the session-reminder scheduler.
// Shared by the browser-side hook (src/hooks/useNotificationScheduler.ts);
// the Electron main process keeps its own copy (electron/scheduler.js) since
// it runs as plain CommonJS outside the Next.js/TS build.

export const FIRE_WINDOW_MIN = 20;

/** Minutes since local midnight for a "HH:MM" string. */
export function slotMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * True when `now` falls inside the firing window of the slot
 * (slot time to slot time + FIRE_WINDOW_MIN). Tolerates the app being opened
 * a few minutes late instead of requiring an exact minute match.
 */
export function isSlotDue(hhmm: string | undefined, now: Date = new Date()): boolean {
  if (!hhmm) return false;
  const nowM = now.getHours() * 60 + now.getMinutes();
  const start = slotMinutes(hhmm);
  return nowM >= start && nowM < start + FIRE_WINDOW_MIN;
}

export interface ReminderProfile {
  sessionMode: string;
  morningTime?: string;
  eveningTime?: string;
  singleSessionTime?: string;
}

export interface DueReminder {
  key: 'single' | 'morning' | 'evening';
  title: string;
  body: string;
}

/**
 * Given a profile, the current time, and the set of reminder keys already
 * fired today, returns the reminder that should fire now, if any.
 * `morningDone` controls the evening message wording (accumulation hint).
 */
export function resolveDueReminder(
  profile: ReminderProfile,
  now: Date,
  firedKeys: Set<string>,
  morningDone: boolean
): DueReminder | null {
  if (profile.sessionMode === 'ONE_SESSION') {
    if (isSlotDue(profile.singleSessionTime, now) && !firedKeys.has('single')) {
      return {
        key: 'single',
        title: 'SkillForge — Session du jour',
        body: 'C’est l’heure de votre session d’apprentissage !',
      };
    }
    return null;
  }

  if (isSlotDue(profile.morningTime, now) && !firedKeys.has('morning')) {
    return {
      key: 'morning',
      title: 'SkillForge — Session du matin',
      body: 'C’est l’heure de votre session du matin (30 min).',
    };
  }
  if (isSlotDue(profile.eveningTime, now) && !firedKeys.has('evening')) {
    return {
      key: 'evening',
      title: 'SkillForge — Session du soir',
      body: morningDone
        ? 'C’est l’heure de votre session du soir (30 min).'
        : 'Session du soir : pensez à cumuler si vous avez manqué le matin (jusqu’à 60 min).',
    };
  }
  return null;
}
