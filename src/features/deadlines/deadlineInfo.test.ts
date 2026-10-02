import { describe, expect, it } from 'vitest';
import { deadlineInfo, orderDeadlines } from './deadlineInfo';

// 2 октября 2026, 12:00 по местному времени
const NOW = new Date(2026, 9, 2, 12).getTime();
const at = (day: number, hour = 23, minute = 59) => new Date(2026, 9, day, hour, minute).toISOString();

describe('deadlineInfo', () => {
  it('дни по календарю: сегодня, завтра, через N дн., просрочен', () => {
    expect(deadlineInfo(at(2), NOW).label).toBe('Сегодня');
    expect(deadlineInfo(at(3), NOW).label).toBe('Завтра');
    expect(deadlineInfo(at(9), NOW).label).toBe('Через 7 дн.');
    expect(deadlineInfo(at(1), NOW)).toMatchObject({ label: 'Просрочен', tone: 'danger' });
  });

  it('цвет по оставшимся часам', () => {
    expect(deadlineInfo(at(2), NOW).tone).toBe('danger');
    expect(deadlineInfo(at(4), NOW).tone).toBe('warning');
    expect(deadlineInfo(at(9), NOW).tone).toBe('success');
  });

  it('порядок: ближайшие, затем просроченные (свежие выше), затем выполненные', () => {
    const items = [
      { id: 'old', name: 'a', deadline: new Date(2026, 8, 28, 12).toISOString() },
      { id: 'late', name: 'b', deadline: at(1) },
      { id: 'soon', name: 'c', deadline: at(9) },
      { id: 'today', name: 'd', deadline: at(2) },
      { id: 'done', name: 'e', deadline: at(5) },
    ];
    expect(orderDeadlines(items, { done: true }, NOW).map((item) => item.id)).toEqual(['today', 'soon', 'late', 'old', 'done']);
  });
});
