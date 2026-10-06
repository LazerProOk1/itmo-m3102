import { describe, expect, it } from 'vitest';
import { getStudyWeek } from './studyWeek';

// Семестр с 1 сентября, 14.09.2026 — понедельник нечётной (1) недели.
const SEMESTER_START = '2026-09-01';
const WEEK_ONE_START = '2026-09-14';

describe('getStudyWeek', () => {
  it('неделя weekOneStart — нечётная (1), вся неделя с понедельника по воскресенье', () => {
    expect(getStudyWeek('2026-09-14', SEMESTER_START, WEEK_ONE_START)).toEqual({ number: 3, weekInCycle: 1 });
    expect(getStudyWeek('2026-09-20', SEMESTER_START, WEEK_ONE_START)).toEqual({ number: 3, weekInCycle: 1 });
  });

  it('следующая — чётная (2), потом снова нечётная', () => {
    expect(getStudyWeek('2026-09-23', SEMESTER_START, WEEK_ONE_START)).toEqual({ number: 4, weekInCycle: 2 });
    expect(getStudyWeek('2026-09-28', SEMESTER_START, WEEK_ONE_START)).toEqual({ number: 5, weekInCycle: 1 });
    expect(getStudyWeek('2026-10-05', SEMESTER_START, WEEK_ONE_START)).toEqual({ number: 6, weekInCycle: 2 });
  });

  it('даты до weekOneStart тоже чередуются (двойной модуль для отрицательных недель)', () => {
    expect(getStudyWeek('2026-09-07', SEMESTER_START, WEEK_ONE_START)).toEqual({ number: 2, weekInCycle: 2 });
    expect(getStudyWeek('2026-08-31', SEMESTER_START, WEEK_ONE_START)).toEqual({ number: 1, weekInCycle: 1 });
  });

  it('переход через год', () => {
    // 15 недель после 14 сентября — нечётное число → чётная неделя
    expect(getStudyWeek('2026-12-28', SEMESTER_START, WEEK_ONE_START)).toEqual({ number: 18, weekInCycle: 2 });
  });

  it('weekOneStart не в понедельник — считается от понедельника той недели', () => {
    expect(getStudyWeek('2026-09-14', SEMESTER_START, '2026-09-16')).toEqual({ number: 3, weekInCycle: 1 });
  });
});
