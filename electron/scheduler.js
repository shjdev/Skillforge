// Pure, testable helpers for the main-process reminder scheduler.
// Mirrors src/lib/notifications.ts — kept as a separate CommonJS module
// because electron/ runs outside the Next.js/TS build.

const FIRE_WINDOW_MIN = 20;

/** Minutes since local midnight for a "HH:MM" string. */
function slotMinutes(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * True when `now` falls inside the firing window of the slot
 * (slot time to slot time + FIRE_WINDOW_MIN).
 */
function isSlotDue(hhmm, now) {
  if (!hhmm) return false;
  const nowM = now.getHours() * 60 + now.getMinutes();
  const start = slotMinutes(hhmm);
  return nowM >= start && nowM < start + FIRE_WINDOW_MIN;
}

/**
 * Given a profile, the current time, and the set of reminder keys already
 * fired today, returns the reminder that should fire now, if any.
 */
function resolveDueReminder(profile, now, firedKeys) {
  if (!profile) return null;

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
      body: 'C’est l’heure de votre session du soir (30 min).',
    };
  }
  return null;
}

/** YYYY-MM-DD for `now`, used to reset the fired-keys set once per day. */
function dateKey(now) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = { FIRE_WINDOW_MIN, slotMinutes, isSlotDue, resolveDueReminder, dateKey };
