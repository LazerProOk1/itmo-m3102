import type { ISODate } from '../types/models';

/**
 * Календарь в формате iCalendar (RFC 5545) — для Google Календаря, Apple Календаря и Outlook: файлом или
 * подпиской по ссылке. Чистые функции: работают и в браузере («Скачать .ics»), и при сборке сайта
 * (scripts/build-ics.ts пишет dist/m3102.ics для подписки).
 */
export interface IcsEvent {
  /** Стабильный id: при обновлении подписки календарь меняет событие, а не заводит второе */
  uid: string;
  title: string;
  date: ISODate;
  /** "09:50" по Москве; нет — событие на весь день */
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  /** Напоминание за столько минут до начала (у события на весь день — от полуночи) */
  alarmMinutes?: number;
  /** Отменённое занятие: календарь покажет его зачёркнутым, а не удалит молча */
  cancelled?: boolean;
}

/** Москва — UTC+3 круглый год (без перехода на летнее время с 2014) */
const MSK_OFFSET_HOURS = 3;

const pad = (value: number) => String(value).padStart(2, '0');

/** "2026-10-08" + "09:50" (МСК) → "20261008T065000Z" */
export function utcStamp(date: ISODate, time: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  const at = new Date(Date.UTC(year, month - 1, day, hours - MSK_OFFSET_HOURS, minutes));
  return `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}T${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}00Z`;
}

const dateStamp = (date: ISODate) => date.replace(/-/g, '');

function nextDay(date: ISODate): ISODate {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** Текст значения: \ ; , и переводы строк экранируются */
export const escapeText = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Строка длиннее 75 байт переносится: CRLF и пробел (кириллица — по 2 байта, режем по символам) */
export function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function buildIcs(events: IcsEvent[], options: { name: string; now?: Date }): string {
  const now = options.now ?? new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//M3102//Uchebnoe prostranstvo//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(options.name)}`,
    'X-WR-TIMEZONE:Europe/Moscow',
    // Как часто подписке обновляться: календари берут подсказку (Apple, Outlook), Google — по-своему
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];
  for (const event of events) {
    lines.push('BEGIN:VEVENT', `UID:${event.uid}`, `DTSTAMP:${stamp}`, `SUMMARY:${escapeText(event.title)}`);
    if (event.startTime) {
      lines.push(`DTSTART:${utcStamp(event.date, event.startTime)}`, `DTEND:${utcStamp(event.date, event.endTime ?? event.startTime)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(event.date)}`, `DTEND;VALUE=DATE:${dateStamp(nextDay(event.date))}`);
    }
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.cancelled) lines.push('STATUS:CANCELLED');
    if (event.alarmMinutes !== undefined)
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(event.title)}`, `TRIGGER:-PT${event.alarmMinutes}M`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
