import { addDays, formatOnWeekday, minutesBetween } from '../../lib/dates';
import type { ISODate } from '../../types/models';
import { getOccurrencesForDate, takesPlace, type ClassOccurrence, type ScheduleData } from '../schedule/occurrences';

export type ClassStatus =
  /** Занятие идёт прямо сейчас */
  | { kind: 'now'; occurrence: ClassOccurrence; minutesLeft: number }
  /** Сегодня ещё будет занятие */
  | { kind: 'next'; occurrence: ClassOccurrence; minutesUntil: number }
  /** Сегодня занятий больше нет; next — первое занятие в ближайшие дни */
  | { kind: 'finished'; next?: { occurrence: ClassOccurrence; dayLabel: string } };

const DAYS_TO_LOOK_AHEAD = 7;

/** Занятия дня, которые реально проходят (без отменённых и перенесённых отсюда), по времени начала */
function getActiveOccurrences(date: ISODate, data: ScheduleData): ClassOccurrence[] {
  return getOccurrencesForDate(date, data).filter(takesPlace);
}

/** Что показать в главном блоке Today. time — текущее время "HH:mm". */
export function getClassStatus(data: ScheduleData, today: ISODate, time: string): ClassStatus {
  const todayOccurrences = getActiveOccurrences(today, data);

  const current = todayOccurrences.find((occurrence) => occurrence.details.startTime <= time && time < occurrence.details.endTime);
  if (current) {
    return { kind: 'now', occurrence: current, minutesLeft: minutesBetween(time, current.details.endTime) };
  }

  const next = todayOccurrences.find((occurrence) => occurrence.details.startTime > time);
  if (next) {
    return { kind: 'next', occurrence: next, minutesUntil: minutesBetween(time, next.details.startTime) };
  }

  for (let offset = 1; offset <= DAYS_TO_LOOK_AHEAD; offset++) {
    const date = addDays(today, offset);
    const [first] = getActiveOccurrences(date, data);
    if (first) {
      const dayLabel = offset === 1 ? 'завтра' : formatOnWeekday(date);
      return { kind: 'finished', next: { occurrence: first, dayLabel } };
    }
  }

  return { kind: 'finished' };
}
