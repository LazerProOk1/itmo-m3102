import { expect, it } from 'vitest';
import { seasonOf } from './season';

it('сезонная деталь ёжика — только в свои дни', () => {
  expect(seasonOf('2026-12-31')).toBe('newyear');
  expect(seasonOf('2027-01-10')).toBe('newyear');
  expect(seasonOf('2027-01-11')).toBeNull();
  expect(seasonOf('2026-10-31')).toBe('halloween');
  expect(seasonOf('2026-09-01')).toBe('knowledge');
  expect(seasonOf('2026-10-04')).toBeNull();
});
