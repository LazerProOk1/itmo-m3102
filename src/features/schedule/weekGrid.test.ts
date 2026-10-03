import { describe, expect, it } from 'vitest';
import type { ClassOccurrence } from './occurrences';
import { gridHours, layoutDay } from './weekGrid';

const at = (key: string, startTime: string, endTime: string) =>
  ({ key, date: '2026-10-05', status: 'regular', details: { startTime, endTime } }) as unknown as ClassOccurrence;

describe('сетка недели', () => {
  it('пары подряд — по одной дорожке, пересекающиеся — рядом', () => {
    const slots = layoutDay([at('b', '10:00', '11:30'), at('a', '08:20', '09:50'), at('c', '10:00', '11:30'), at('d', '11:40', '13:10')]);
    expect(slots.map((slot) => [slot.occurrence.key, slot.lane, slot.lanes])).toEqual([
      ['a', 0, 1],
      ['b', 0, 2],
      ['c', 1, 2],
      ['d', 0, 1],
    ]);
  });

  it('часы — от часа первой пары до часа после последней', () => {
    const occurrences = [at('a', '08:20', '09:50'), at('b', '15:20', '16:50')];
    expect(gridHours([{ date: '2026-10-05', occurrences }])).toEqual({ from: 8 * 60, to: 17 * 60 });
    expect(gridHours([{ date: '2026-10-05', occurrences: [] }])).toEqual({ from: 9 * 60, to: 18 * 60 });
  });
});
