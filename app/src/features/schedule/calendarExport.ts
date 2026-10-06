import { addDays } from '../../lib/dates';
import type { IcsEvent } from '../../lib/ics';
import type { Event, ISODate, Subject, Task } from '../../types/models';
import type { GroupDeadline } from '../group/groupStore';
import type { HomeworkItem } from '../homework/homeworkStore';
import { CLASS_TYPE_LABELS, describeMove } from './labels';
import { getOccurrencesForDate, type ScheduleData } from './occurrences';

/** Ссылка-подписка: файл собирает GitHub при каждой сборке сайта и раз в сутки (scripts/build-ics.ts) */
export const SUBSCRIPTION_URL = 'https://redstonelord.github.io/itmo-m3102/m3102.ics';

/** Дедлайн «до 23:59» напоминает накануне в 9:00 (15 ч до полуночи дня сдачи) */
const DEADLINE_ALARM_MINUTES = 15 * 60;

interface GroupCalendar {
  schedule: ScheduleData;
  subjects: Subject[];
  deadlines: GroupDeadline[];
  homework: HomeworkItem[];
  from: ISODate;
  /** Сколько дней вперёд разворачивать пары */
  days: number;
}

/**
 * События группы для календаря: пары с учётом переносов, замен и отмен (отменённая — зачёркнутой), дедлайны
 * группы и ДЗ в день сдачи. Отдельные события, а не повторяющееся правило: у нас чередование недель и
 * исключения, которые RRULE не выразит.
 */
export function groupCalendarEvents({ schedule, subjects, deadlines, homework, from, days }: GroupCalendar): IcsEvent[] {
  const subjectName = (id: string) => subjects.find((subject) => subject.id === id)?.name ?? 'Пара';
  const events: IcsEvent[] = [];

  for (let offset = 0; offset < days; offset++) {
    const date = addDays(from, offset);
    for (const occurrence of getOccurrencesForDate(date, schedule)) {
      // Перенесённая отсюда пара покажется в новый день как movedHere — здесь её не дублируем
      if (occurrence.status === 'movedAway') continue;
      const { details } = occurrence;
      const notes = [
        details.teacher,
        details.subgroup && `Группа: ${details.subgroup}`,
        describeMove(occurrence),
        occurrence.status === 'replaced' && 'Замена',
        occurrence.status === 'additional' && 'Разовое занятие',
        details.link,
        details.notes,
      ].filter(Boolean);
      events.push({
        uid: `${occurrence.key}@m3102`,
        title: `${subjectName(details.subjectId)} — ${CLASS_TYPE_LABELS[details.type]}`,
        date,
        startTime: details.startTime,
        endTime: details.endTime,
        location: [details.room && `ауд. ${details.room}`, details.building].filter(Boolean).join(', ') || undefined,
        description: notes.join('\n') || undefined,
        cancelled: occurrence.status === 'cancelled',
      });
    }
  }

  for (const deadline of deadlines) {
    const date = deadline.deadline.slice(0, 10);
    events.push({
      uid: `deadline-${deadline.id}@m3102`,
      title: `Дедлайн: ${deadline.name} (до ${deadline.deadline.slice(11, 16)})`,
      date,
      description: deadline.note,
      alarmMinutes: DEADLINE_ALARM_MINUTES,
    });
  }

  for (const item of homework) {
    if (!item.due) continue;
    events.push({ uid: `homework-${item.id}@m3102`, title: `ДЗ: ${item.subject}`, date: item.due, description: item.text });
  }
  return events;
}

/** Личное — только в файле «Скачать .ics»: свои события и задачи учебного плана со сроком */
export function personalCalendarEvents(events: Event[], tasks: Task[]): IcsEvent[] {
  return [
    ...events.map((event) => ({
      uid: `event-${event.id}@m3102`,
      title: event.title,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      description: event.description,
    })),
    ...tasks
      .filter((task) => task.deadline && task.status !== 'done')
      .map((task) => ({ uid: `task-${task.id}@m3102`, title: `Задача: ${task.title}`, date: task.deadline!, alarmMinutes: DEADLINE_ALARM_MINUTES })),
  ];
}
