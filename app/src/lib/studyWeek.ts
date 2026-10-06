import type { ISODate, WeekInCycle } from '../types/models';
import { startOfWeek } from './dates';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = MS_PER_DAY * 7;

/** Расписание чередуется: неделя 1 цикла — нечётная, неделя 2 — чётная */
const CYCLE_LENGTH = 2;

export const WEEK_PARITY_LABELS: Record<WeekInCycle, string> = { 1: 'Нечётная неделя', 2: 'Чётная неделя' };

export interface StudyWeek {
  /** Номер учебной недели с начала семестра: 1 — неделя начала, 2 — следующая, и т. д. */
  number: number;
  /** Какая неделя цикла — 1 (нечётная) или 2 (чётная). Не зависит от semesterStart, только от weekOneStart. */
  weekInCycle: WeekInCycle;
}

/**
 * Номер учебной недели (от `semesterStart`) и её чётность (от `weekOneStart`).
 * Неделя всегда идёт с понедельника; неделя, в которую попадает `weekOneStart`, — нечётная (1),
 * дальше 2, 1, 2… в обе стороны. `number < 1` — семестр ещё не начался. Примеры — в studyWeek.test.ts.
 */
export function getStudyWeek(date: ISODate, semesterStart: ISODate, weekOneStart: ISODate): StudyWeek {
  const dateWeekStart = toTimestamp(startOfWeek(date));
  const semesterWeekStart = toTimestamp(startOfWeek(semesterStart));
  const cycleWeekStart = toTimestamp(startOfWeek(weekOneStart));

  const number = Math.round((dateWeekStart - semesterWeekStart) / MS_PER_WEEK) + 1;
  const weeksSinceCycleStart = Math.round((dateWeekStart - cycleWeekStart) / MS_PER_WEEK);
  // % в JS может вернуть отрицательное число — двойной модуль приводит его в диапазон [0, CYCLE_LENGTH)
  const weekInCycle = (((weeksSinceCycleStart % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH) + 1;

  return { number, weekInCycle: weekInCycle as WeekInCycle };
}

function toTimestamp(date: ISODate): number {
  return new Date(`${date}T00:00:00`).getTime();
}
