import { formatTime, toISODate } from '../../lib/dates';
import type { Event, ISODate, Task } from '../../types/models';
import type { GroupDeadline } from '../group/groupStore';
import type { HomeworkItem } from '../homework/homeworkStore';
import { getOccurrencesForDate, takesPlace, type ClassOccurrence, type ScheduleData } from '../schedule/occurrences';

/** Всё, что календарь объединяет на одном экране */
export interface CalendarData {
  schedule: ScheduleData;
  tasks: Task[];
  events: Event[];
  /** Дедлайны группы и ДЗ — с отметками «сделано» этого браузера: сделанное в календаре не показываем */
  groupDeadlines: GroupDeadline[];
  deadlinesDone: Record<string, boolean>;
  homework: HomeworkItem[];
  homeworkDone: Record<string, string>;
}

/**
 * Запись календаря на конкретный день — либо занятие из Schedule, либо дедлайн задачи,
 * либо обычное событие. Занятие всегда несёт время (у него его не бывает без времени);
 * дедлайн — никогда; событие — по желанию (без времени показывается как «весь день»).
 */
export type CalendarEntry =
  | { key: string; kind: 'class'; date: ISODate; startTime: string; endTime: string; occurrence: ClassOccurrence }
  | { key: string; kind: 'deadline'; date: ISODate; startTime?: undefined; endTime?: undefined; task: Task }
  | { key: string; kind: 'event'; date: ISODate; startTime?: string; endTime?: string; event: Event }
  /** Дедлайн группы: весь день, а срок («до 23:59») — подписью */
  | { key: string; kind: 'groupDeadline'; date: ISODate; startTime?: undefined; endTime?: undefined; deadline: GroupDeadline; dueTime: string }
  /** ДЗ группы — в день срока сдачи */
  | { key: string; kind: 'homework'; date: ISODate; startTime?: undefined; endTime?: undefined; item: HomeworkItem };

/** У записи нет времени — показывается в строке «весь день», а не на сетке времени */
export function isAllDay(entry: CalendarEntry): boolean {
  return entry.startTime === undefined;
}

/** Занятие всегда со временем; событие — только если оно указано при создании (иначе оно «весь день») */
export type TimedCalendarEntry =
  Extract<CalendarEntry, { kind: 'class' }> | (Extract<CalendarEntry, { kind: 'event' }> & { startTime: string; endTime: string });

/** Есть ли у записи конкретное время — тогда ей место на сетке времени, а не в строке «весь день» */
export function isTimedEntry(entry: CalendarEntry): entry is TimedCalendarEntry {
  return entry.startTime !== undefined;
}

/** Записи на дату, отсортированные так, что «весь день» идёт перед записями с конкретным временем */
export function getCalendarEntriesForDate(date: ISODate, data: CalendarData): CalendarEntry[] {
  const classEntries: CalendarEntry[] = getOccurrencesForDate(date, data.schedule)
    .filter(takesPlace)
    .map((occurrence) => ({
      key: occurrence.key,
      kind: 'class',
      date,
      startTime: occurrence.details.startTime,
      endTime: occurrence.details.endTime,
      occurrence,
    }));

  const deadlineEntries: CalendarEntry[] = data.tasks
    .filter((task) => task.status !== 'done' && task.deadline === date)
    .map((task) => ({ key: `deadline:${task.id}`, kind: 'deadline', date, task }));

  const groupDeadlineEntries: CalendarEntry[] = data.groupDeadlines
    .filter((deadline) => !data.deadlinesDone[deadline.id] && toISODate(new Date(deadline.deadline)) === date)
    .map((deadline) => ({
      key: `group-deadline:${deadline.id}`,
      kind: 'groupDeadline',
      date,
      deadline,
      dueTime: formatTime(new Date(deadline.deadline)),
    }));

  const homeworkEntries: CalendarEntry[] = data.homework
    .filter((item) => item.due === date && !data.homeworkDone[item.id])
    .map((item) => ({ key: `homework:${item.id}`, kind: 'homework', date, item }));

  const eventEntries: CalendarEntry[] = data.events
    .filter((event) => event.date === date)
    .map((event) => ({ key: `event:${event.id}`, kind: 'event', date, startTime: event.startTime, endTime: event.endTime, event }));

  return [...classEntries, ...groupDeadlineEntries, ...deadlineEntries, ...homeworkEntries, ...eventEntries].sort((a, b) => {
    const aAllDay = isAllDay(a);
    const bAllDay = isAllDay(b);
    if (aAllDay !== bAllDay) return aAllDay ? -1 : 1;
    return (a.startTime ?? '').localeCompare(b.startTime ?? '');
  });
}
