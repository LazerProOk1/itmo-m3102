import { describe, expect, it } from 'vitest';
import { deadlineSubjectId, getNextDeadline } from './subjectStats';

describe('subjectStats', () => {
  it('предмет дедлайна по префиксу названия', () => {
    expect(deadlineSubjectId('ДМ - Карточки')).toBe('dm');
    expect(deadlineSubjectId('ИСРПО — Документация')).toBe('isrpo');
    expect(deadlineSubjectId('АИСД - Лаба')).toBe('aisd');
    expect(deadlineSubjectId('Без предмета')).toBeUndefined();
  });

  it('ближайший срок — с дедлайнами группы, без прошедших и выполненных', () => {
    const deadlines = [
      { id: 'a', name: 'ДМ - Карточки', deadline: '2026-09-30T23:59:00+03:00' },
      { id: 'b', name: 'ДМ - ДЗ', deadline: '2026-10-11T23:59:00+03:00' },
      { id: 'c', name: 'ДМ - Тест', deadline: '2026-10-05T23:59:00+03:00' },
    ];
    expect(getNextDeadline([], 'dm', '2026-10-01', { deadlines, done: { c: true } })).toBe('2026-10-11');
    expect(getNextDeadline([], 'op', '2026-10-01', { deadlines, done: {} })).toBeUndefined();
  });
});
