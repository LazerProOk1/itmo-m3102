import { addDays, startOfMonth, startOfWeek } from '../../lib/dates';
import type { ISODate } from '../../types/models';

const WEEKS_IN_GRID = 6;

/**
 * Все даты для сетки месяца: 6 полных недель (42 дня) начиная с понедельника той недели,
 * в которую попадает 1-е число месяца. Шести недель хватает на любой месяц при любом
 * дне недели, с которого он начинается — сетка всегда одной и той же высоты,
 * и при переключении между месяцами страница не «прыгает».
 */
export function getMonthGridDates(anchor: ISODate): ISODate[] {
  const gridStart = startOfWeek(startOfMonth(anchor));
  return Array.from({ length: WEEKS_IN_GRID * 7 }, (_, index) => addDays(gridStart, index));
}

/** В сетке месяца дни идут неделями по 7 — эта функция режет плоский список на строки */
export function chunkIntoWeeks(dates: ISODate[]): ISODate[][] {
  const weeks: ISODate[][] = [];
  for (let index = 0; index < dates.length; index += 7) {
    weeks.push(dates.slice(index, index + 7));
  }
  return weeks;
}
