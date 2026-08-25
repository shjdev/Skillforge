// Shared helpers for ordering lessons within a topic and computing progress.
// A topic's day cycle is 1..7, and within a day MORNING/FULL_DAY come before EVENING.

const SESSION_ORDER: Record<string, number> = {
  MORNING: 0,
  FULL_DAY: 0,
  EVENING: 1,
};

export function sessionOrder(sessionType: string): number {
  return SESSION_ORDER[sessionType] ?? 0;
}

export function sortLessons<T extends { dayNumber: number; sessionType: string }>(
  lessons: T[]
): T[] {
  return [...lessons].sort((a, b) => {
    if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
    return sessionOrder(a.sessionType) - sessionOrder(b.sessionType);
  });
}

export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const XP_PER_LESSON = 50;
export const XP_PER_QUIZ_PASS = 100;
export const DEFAULT_USER_ID = 'default-user';
