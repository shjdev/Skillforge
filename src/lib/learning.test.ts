import { describe, it, expect, vi, afterEach } from 'vitest';
import { sessionOrder, sortLessons, todayStr, yesterdayStr, XP_PER_LESSON, XP_PER_QUIZ_PASS } from './learning';

describe('sessionOrder', () => {
  it('orders MORNING and FULL_DAY before EVENING', () => {
    expect(sessionOrder('MORNING')).toBe(0);
    expect(sessionOrder('FULL_DAY')).toBe(0);
    expect(sessionOrder('EVENING')).toBe(1);
  });

  it('defaults unknown session types to 0', () => {
    expect(sessionOrder('SOMETHING_ELSE')).toBe(0);
  });
});

describe('sortLessons', () => {
  it('sorts by dayNumber first', () => {
    const lessons = [
      { id: 'c', dayNumber: 3, sessionType: 'MORNING' },
      { id: 'a', dayNumber: 1, sessionType: 'EVENING' },
      { id: 'b', dayNumber: 2, sessionType: 'MORNING' },
    ];
    expect(sortLessons(lessons).map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });

  it('within the same day, puts MORNING/FULL_DAY before EVENING', () => {
    const lessons = [
      { id: 'evening', dayNumber: 1, sessionType: 'EVENING' },
      { id: 'morning', dayNumber: 1, sessionType: 'MORNING' },
    ];
    expect(sortLessons(lessons).map((l) => l.id)).toEqual(['morning', 'evening']);
  });

  it('does not mutate the input array', () => {
    const lessons = [
      { id: 'b', dayNumber: 2, sessionType: 'MORNING' },
      { id: 'a', dayNumber: 1, sessionType: 'MORNING' },
    ];
    const original = [...lessons];
    sortLessons(lessons);
    expect(lessons).toEqual(original);
  });
});

describe('todayStr / yesterdayStr', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats dates as YYYY-MM-DD', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 25, 10, 0, 0)); // 2026-08-25
    expect(todayStr()).toBe('2026-08-25');
    expect(yesterdayStr()).toBe('2026-08-24');
  });

  it('yesterdayStr crosses month boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 1, 10, 0, 0)); // 2026-09-01
    expect(yesterdayStr()).toBe('2026-08-31');
  });
});

describe('XP constants', () => {
  it('are positive integers', () => {
    expect(XP_PER_LESSON).toBeGreaterThan(0);
    expect(XP_PER_QUIZ_PASS).toBeGreaterThan(0);
  });
});
