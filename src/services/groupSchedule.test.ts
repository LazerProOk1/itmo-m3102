import { describe, expect, it } from 'vitest';
import { parseGroupSchedule } from './groupSchedule';

const lesson = (id: string, start: string, end: string, subject: string, extra: object = {}) => ({
  id,
  start,
  end,
  subject,
  room: '2304',
  teacher: 'Т',
  ...extra,
});

function cycle() {
  const days: unknown[][] = Array.from({ length: 14 }, () => []);
  // Пт нечётной (индекс 4) и чётной (индекс 11) недели
  days[4] = [lesson('a', '13:30', '15:00', 'Математический анализ'), lesson('b', '15:30', '17:00', 'Инструментальные средства разработки ПО')];
  days[11] = [lesson('c', '13:30', '15:00', 'Математический анализ'), lesson('d', '15:30', '17:00', 'Математический анализ')];
  days[5] = [lesson('e', '13:00', '15:30', 'Перерыв', { break: true }), lesson('f', '09:50', '11:20', 'English B1.1')];
  return days;
}

describe('parseGroupSchedule', () => {
  const schedule = parseGroupSchedule({
    anchorMonday: '2026-09-21',
    anchorParity: 'even',
    defaultLocation: 'Кронверкский',
    cycle: cycle(),
    overrides: {
      '2026-09-25': {
        note: 'Замена',
        lessons: [lesson('x', '13:30', '15:00', 'Математический анализ'), lesson('y', '17:10', '18:40', 'Дискретная математика')],
      },
    },
  });

  it('одинаковые пары обеих недель — «каждую неделю», разные — по чётности', () => {
    const friday = schedule.classes.filter((item) => item.weekday === 5).map((item) => `${item.startTime} ${item.subjectId} ${item.weeks}`);
    expect(friday).toEqual(['13:30 matan every', '15:30 isrpo 1', '15:30 matan 2']);
  });

  it('перерывы пропускаются, неизвестные предметы перечислены', () => {
    expect(schedule.classes.some((item) => item.weekday === 6)).toBe(false);
    expect(schedule.unknownSubjects).toEqual(['English B1.1']);
  });

  it('чётность: 21.09 чётная → неделя 1 (нечётная) начинается 14.09', () => {
    expect(schedule.weekOneStart).toBe('2026-09-14');
  });

  it('замена дня: совпадающая пара остаётся, лишняя отменяется, новая добавляется', () => {
    // 25.09 — пятница чётной недели: регулярно матан 13:30 и матан 15:30
    const kinds = schedule.exceptions.map((item) => `${item.kind}:${item.kind === 'additional' ? item.details.startTime : item.classId}`);
    expect(kinds).toEqual(['cancelled:gh:schedule:d', 'additional:17:10']);
    expect(schedule.exceptions[0]!.note).toBe('Замена');
  });

  it('битый файл — ошибка, а не пустое расписание', () => {
    expect(() => parseGroupSchedule({ cycle: [] })).toThrow();
  });
});
