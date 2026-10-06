import { describe, expect, it } from 'vitest';
import { buildIcs, escapeText, fold, utcStamp } from './ics';

describe('iCalendar', () => {
  it('московское время → UTC, переход через полночь', () => {
    expect(utcStamp('2026-10-08', '09:50')).toBe('20261008T065000Z');
    expect(utcStamp('2026-10-08', '01:30')).toBe('20261007T223000Z');
  });

  it('экранирование и перенос длинных строк по 75 байт (кириллица — 2 байта)', () => {
    expect(escapeText('Лаба; ДМ, вариант\\1\nвторая строка')).toBe('Лаба\\; ДМ\\, вариант\\\\1\\nвторая строка');
    const folded = fold(`SUMMARY:${'Дискретная математика '.repeat(5)}`);
    for (const line of folded.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(`SUMMARY:${'Дискретная математика '.repeat(5)}`);
  });

  it('пара со временем, дедлайн на весь день с напоминанием, отмена', () => {
    const text = buildIcs(
      [
        {
          uid: 'pair-1@m3102',
          title: 'Линейная алгебра (Практика)',
          date: '2026-10-08',
          startTime: '09:50',
          endTime: '11:20',
          location: 'ауд. 2430',
        },
        { uid: 'dl-1@m3102', title: 'Дедлайн: ОП — первая лаба', date: '2026-10-11', alarmMinutes: 900 },
        { uid: 'pair-2@m3102', title: 'Матан', date: '2026-10-09', startTime: '13:30', endTime: '15:00', cancelled: true },
      ],
      { name: 'М3102', now: new Date('2026-10-04T00:00:00Z') },
    );
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(text).toContain('DTSTART:20261008T065000Z\r\nDTEND:20261008T082000Z');
    expect(text).toContain('DTSTART;VALUE=DATE:20261011\r\nDTEND;VALUE=DATE:20261012');
    expect(text).toContain('TRIGGER:-PT900M');
    expect(text).toContain('STATUS:CANCELLED');
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  });
});
