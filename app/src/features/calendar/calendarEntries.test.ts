import { describe, expect, it } from 'vitest';
import type { HomeworkItem } from '../homework/homeworkStore';
import { getCalendarEntriesForDate, type CalendarData } from './calendarEntries';

const homework = (id: string, due: string) => ({ id, subject: 'Матан', due, text: '', links: [] }) as unknown as HomeworkItem;

const data: CalendarData = {
  schedule: { classes: [], exceptions: [], semesterStart: '2026-09-01', weekOneStart: '2026-09-01' },
  tasks: [],
  events: [],
  // Время без пояса — локальное: тест не зависит от часового пояса машины
  groupDeadlines: [
    { id: 'lab1', name: 'Лаба 1', deadline: '2026-10-05T23:59:00' },
    { id: 'lab2', name: 'Лаба 2', deadline: '2026-10-05T18:00:00' },
  ],
  deadlinesDone: { lab2: true },
  homework: [homework('hw1', '2026-10-05'), homework('hw2', '2026-10-06')],
  homeworkDone: {},
};

describe('календарь: дедлайны группы и ДЗ', () => {
  it('в день срока, сделанное скрыто, время дедлайна подписью', () => {
    const entries = getCalendarEntriesForDate('2026-10-05', data);
    expect(entries.map((entry) => entry.key)).toEqual(['group-deadline:lab1', 'homework:hw1']);
    expect(entries[0]).toMatchObject({ kind: 'groupDeadline', dueTime: '23:59' });
    expect(getCalendarEntriesForDate('2026-10-06', data).map((entry) => entry.key)).toEqual(['homework:hw2']);
  });
});
