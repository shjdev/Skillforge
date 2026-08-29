import { describe, it, expect } from 'vitest';
import scheduler from './scheduler.js';

const { slotMinutes, isSlotDue, resolveDueReminder, dateKey, FIRE_WINDOW_MIN } = scheduler;

describe('slotMinutes', () => {
  it('converts HH:MM to minutes since midnight', () => {
    expect(slotMinutes('07:30')).toBe(450);
    expect(slotMinutes('20:00')).toBe(1200);
  });

  it('treats a missing value as 00:00', () => {
    expect(slotMinutes(undefined)).toBe(0);
  });
});

describe('isSlotDue', () => {
  it('is true inside the firing window and false outside it', () => {
    expect(isSlotDue('07:30', new Date(2026, 0, 1, 7, 30))).toBe(true);
    expect(isSlotDue('07:30', new Date(2026, 0, 1, 7, 30 + FIRE_WINDOW_MIN - 1))).toBe(true);
    expect(isSlotDue('07:30', new Date(2026, 0, 1, 7, 30 + FIRE_WINDOW_MIN))).toBe(false);
    expect(isSlotDue('07:30', new Date(2026, 0, 1, 7, 29))).toBe(false);
  });

  it('is false when no slot is configured', () => {
    expect(isSlotDue(null, new Date())).toBe(false);
  });
});

describe('resolveDueReminder', () => {
  it('returns null for a missing profile', () => {
    expect(resolveDueReminder(null, new Date(), new Set())).toBeNull();
  });

  it('fires the single-session reminder in ONE_SESSION mode', () => {
    const profile = { sessionMode: 'ONE_SESSION', singleSessionTime: '19:00' };
    const due = resolveDueReminder(profile, new Date(2026, 0, 1, 19, 0), new Set());
    expect(due.key).toBe('single');
  });

  it('fires morning then evening in TWO_SESSIONS mode, each once', () => {
    const profile = { sessionMode: 'TWO_SESSIONS', morningTime: '07:30', eveningTime: '20:00' };
    const fired = new Set();

    const morning = resolveDueReminder(profile, new Date(2026, 0, 1, 7, 30), fired);
    expect(morning.key).toBe('morning');
    fired.add(morning.key);

    expect(resolveDueReminder(profile, new Date(2026, 0, 1, 7, 35), fired)).toBeNull();

    const evening = resolveDueReminder(profile, new Date(2026, 0, 1, 20, 0), fired);
    expect(evening.key).toBe('evening');
  });
});

describe('dateKey', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 7, 25))).toBe('2026-08-25');
  });
});
