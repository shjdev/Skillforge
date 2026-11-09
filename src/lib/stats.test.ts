import { describe, expect, it } from 'vitest';
import { bucketByDay, dayKey } from './stats';

describe('bucketByDay', () => {
  it('counts lessons and minutes per day, oldest first, ignoring older sessions', () => {
    const now = new Date(2026, 10, 9, 15);
    const at = (d: number, h = 10) => new Date(2026, 10, d, h);
    const out = bucketByDay(
      [
        { completedAt: at(9), durationSeconds: 600 },
        { completedAt: at(9, 20), durationSeconds: 1200 },
        { completedAt: at(7), durationSeconds: 300 },
        { completedAt: at(1), durationSeconds: 300 },
        { completedAt: null, durationSeconds: 300 },
      ],
      3,
      now,
    );
    expect(out.map((d) => d.date)).toEqual([dayKey(at(7)), dayKey(at(8)), dayKey(at(9))]);
    expect(out.map((d) => [d.lessons, d.minutes])).toEqual([[1, 5], [0, 0], [2, 30]]);
  });
});
