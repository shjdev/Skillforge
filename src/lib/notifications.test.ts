import { describe, it, expect } from 'vitest';
import { slotMinutes, isSlotDue, resolveDueReminder, FIRE_WINDOW_MIN } from './notifications';

describe('slotMinutes', () => {
  it('converts HH:MM to minutes since midnight', () => {
    expect(slotMinutes('07:30')).toBe(450);
    expect(slotMinutes('20:00')).toBe(1200);
    expect(slotMinutes('00:00')).toBe(0);
  });
});

describe('isSlotDue', () => {
  it('is false when no slot is configured', () => {
    expect(isSlotDue(undefined, new Date(2026, 0, 1, 7, 30))).toBe(false);
  });

  it('is true exactly at the slot time', () => {
    expect(isSlotDue('07:30', new Date(2026, 0, 1, 7, 30))).toBe(true);
  });

  it('is true within the firing window after the slot time', () => {
    const justInside = new Date(2026, 0, 1, 7, 30 + FIRE_WINDOW_MIN - 1);
    expect(isSlotDue('07:30', justInside)).toBe(true);
  });

  it('is false once the firing window has elapsed', () => {
    const justOutside = new Date(2026, 0, 1, 7, 30 + FIRE_WINDOW_MIN);
    expect(isSlotDue('07:30', justOutside)).toBe(false);
  });

  it('is false before the slot time', () => {
    expect(isSlotDue('07:30', new Date(2026, 0, 1, 7, 29))).toBe(false);
  });
});

describe('resolveDueReminder', () => {
  const morningSlot = new Date(2026, 0, 1, 7, 30);
  const eveningSlot = new Date(2026, 0, 1, 20, 0);
  const offHours = new Date(2026, 0, 1, 12, 0);

  it('fires the single-session reminder in ONE_SESSION mode', () => {
    const profile = { sessionMode: 'ONE_SESSION', singleSessionTime: '19:00' };
    const due = resolveDueReminder(profile, new Date(2026, 0, 1, 19, 0), new Set(), false);
    expect(due?.key).toBe('single');
  });

  it('does not fire the single-session reminder twice the same day', () => {
    const profile = { sessionMode: 'ONE_SESSION', singleSessionTime: '19:00' };
    const due = resolveDueReminder(profile, new Date(2026, 0, 1, 19, 0), new Set(['single']), false);
    expect(due).toBeNull();
  });

  it('fires the morning reminder in TWO_SESSIONS mode', () => {
    const profile = { sessionMode: 'TWO_SESSIONS', morningTime: '07:30', eveningTime: '20:00' };
    const due = resolveDueReminder(profile, morningSlot, new Set(), false);
    expect(due?.key).toBe('morning');
  });

  it('fires the evening reminder with the accumulation hint when morning was missed', () => {
    const profile = { sessionMode: 'TWO_SESSIONS', morningTime: '07:30', eveningTime: '20:00' };
    const due = resolveDueReminder(profile, eveningSlot, new Set(['morning']), false);
    expect(due?.key).toBe('evening');
    expect(due?.body).toMatch(/cumuler/);
  });

  it('fires the evening reminder without the hint when morning was completed', () => {
    const profile = { sessionMode: 'TWO_SESSIONS', morningTime: '07:30', eveningTime: '20:00' };
    const due = resolveDueReminder(profile, eveningSlot, new Set(['morning']), true);
    expect(due?.key).toBe('evening');
    expect(due?.body).not.toMatch(/cumuler/);
  });

  it('returns null when no slot is due', () => {
    const profile = { sessionMode: 'TWO_SESSIONS', morningTime: '07:30', eveningTime: '20:00' };
    expect(resolveDueReminder(profile, offHours, new Set(), false)).toBeNull();
  });

  it('returns null once both TWO_SESSIONS reminders already fired', () => {
    const profile = { sessionMode: 'TWO_SESSIONS', morningTime: '07:30', eveningTime: '20:00' };
    expect(resolveDueReminder(profile, morningSlot, new Set(['morning']), false)).toBeNull();
    expect(resolveDueReminder(profile, eveningSlot, new Set(['evening']), false)).toBeNull();
  });
});
