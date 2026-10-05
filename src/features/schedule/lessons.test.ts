import { expect, it } from 'vitest';
import { M3102_CLASSES, M3102_SEMESTER } from '../../data/m3102';
import { addDays } from '../../lib/dates';
import { getOccurrencesForDate, type ScheduleData } from './occurrences';
import { labelMatches, lessonDate, lessonNumber, parseLessonLabel } from './lessons';

const data: ScheduleData = { classes: M3102_CLASSES, exceptions: [], ...M3102_SEMESTER };

it('папка конспекта ↔ номер пары', () => {
  expect(parseLessonLabel('Лекция 2-3')).toEqual({ kind: 'Лекция', from: 2, to: 3 });
  expect(parseLessonLabel('Доп Материалы')).toBeUndefined();
  expect(labelMatches('Лекция 2-3', { kind: 'Лекция', n: 3 })).toBe(true);
  expect(labelMatches('Лекция 2-3', { kind: 'Практика', n: 3 })).toBe(false);
  expect(labelMatches('Практика 1', { kind: 'Практика', n: 2 })).toBe(false);
});

it('вторая лекция по предмету — «Лекция 2», и обратно: дата «Лекции 2» — дата этой пары', () => {
  const lectures = [];
  for (let date = data.semesterStart; lectures.length < 2; date = addDays(date, 1))
    lectures.push(...getOccurrencesForDate(date, data).filter((item) => item.details.subjectId === 'dm' && item.details.type === 'lecture'));
  const second = lectures[1]!;
  expect(lessonNumber(second, data)).toEqual({ kind: 'Лекция', n: 2 });
  expect(lessonDate('dm', 'Лекция 2', data, addDays(second.date, 30))).toBe(second.date);
});
