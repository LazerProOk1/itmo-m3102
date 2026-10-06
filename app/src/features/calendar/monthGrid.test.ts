import { describe, expect, it } from 'vitest';
import { chunkIntoWeeks, getMonthGridDates } from './monthGrid';

describe('getMonthGridDates', () => {
  it('always returns 42 dates (6 full weeks)', () => {
    expect(getMonthGridDates('2026-09-15')).toHaveLength(42);
  });

  it('September 2026 (starts on Tuesday): grid runs Mon 31 Aug – Sun 11 Oct', () => {
    const dates = getMonthGridDates('2026-09-15');
    expect(dates[0]).toBe('2026-08-31');
    expect(dates.at(-1)).toBe('2026-10-11');
    expect(dates).toContain('2026-09-01');
    expect(dates).toContain('2026-09-30');
  });

  it('February 2027 (starts on Monday, month itself is exactly 4 weeks): grid still pads to 6 weeks', () => {
    const dates = getMonthGridDates('2027-02-10');
    // 1 февраля 2027 — само понедельник, значит паддинга в начале не нужно
    expect(dates[0]).toBe('2027-02-01');
    expect(dates.at(-1)).toBe('2027-03-14');
  });

  it('February 2026 (starts on Sunday — the case needing the most leading padding)', () => {
    const dates = getMonthGridDates('2026-02-10');
    expect(dates[0]).toBe('2026-01-26');
    expect(dates.at(-1)).toBe('2026-03-08');
  });

  it('any date within the month resolves to the same grid', () => {
    expect(getMonthGridDates('2026-09-01')).toEqual(getMonthGridDates('2026-09-30'));
  });
});

describe('chunkIntoWeeks', () => {
  it('splits the flat 42-date list into 6 rows of 7', () => {
    const weeks = chunkIntoWeeks(getMonthGridDates('2026-09-15'));
    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]![0]).toBe('2026-08-31');
    expect(weeks[5]![6]).toBe('2026-10-11');
  });
});
