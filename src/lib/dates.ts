import type { ISODate, Weekday } from '../types/models';

/** Именительный падеж, индекс 0 = воскресенье (соответствует Date.getDay()) */
const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
/** Короткие обозначения дней недели, как принято в русском календаре (2 буквы) */
const SHORT_WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
/** Предложный падеж с предлогом — для конструкций вида «во вторник» */
const WEEKDAYS_ON = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];

/** Именительный падеж — для отдельного заголовка вида «Сентябрь 2026» */
const MONTHS_NOMINATIVE = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
/** Родительный падеж — для дат вида «15 сентября 2026» (первые 3 буквы = принятое сокращение) */
const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** "2026-09-15" → Date (полночь по местному времени) */
function toDate(date: ISODate): Date {
  return new Date(`${date}T00:00:00`);
}

/** Date → "2026-09-15" (по местному времени) */
export function toISODate(date: Date): ISODate {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Date → "09:18" */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** addDays("2026-09-15", 3) → "2026-09-18" */
export function addDays(date: ISODate, days: number): ISODate {
  const result = toDate(date);
  result.setDate(result.getDate() + days);
  return toISODate(result);
}

/** "2026-09-15" → 2 (вторник) */
export function getWeekday(date: ISODate): Weekday {
  return (toDate(date).getDay() || 7) as Weekday;
}

/** Понедельник той же недели */
export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, 1 - getWeekday(date));
}

/** Семь дат недели, начиная с понедельника */
export function getWeekDates(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/** addMonths("2026-09-15", 1) → "2026-10-15" */
export function addMonths(date: ISODate, months: number): ISODate {
  const result = toDate(date);
  result.setMonth(result.getMonth() + months);
  return toISODate(result);
}

/** Первое число того же месяца */
export function startOfMonth(date: ISODate): ISODate {
  const result = toDate(date);
  result.setDate(1);
  return toISODate(result);
}

/** Сколько дней от одной даты до другой (может быть отрицательным) */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / (24 * 60 * 60 * 1000));
}

/** "2026-09-15" → "Вторник" (именительный падеж, для отдельной подписи) */
export function getWeekdayName(date: ISODate): string {
  return WEEKDAYS[toDate(date).getDay()]!;
}

/** "2026-09-15" → "Вт" (короткое обозначение для заголовков колонок) */
export function getShortWeekdayName(date: ISODate): string {
  return SHORT_WEEKDAYS[toDate(date).getDay()]!;
}

/** "2026-09-15" → "во вторник" (для фраз вида «Следующая пара во вторник») */
export function formatOnWeekday(date: ISODate): string {
  return WEEKDAYS_ON[toDate(date).getDay()]!;
}

/** "2026-09-15" → 15 */
export function getDayOfMonth(date: ISODate): number {
  return toDate(date).getDate();
}

/** "2026-09-15" → "15 сентября 2026" */
export function formatFullDate(date: ISODate): string {
  const value = toDate(date);
  return `${value.getDate()} ${MONTHS_GENITIVE[value.getMonth()]} ${value.getFullYear()}`;
}

/** "2026-09-15" → "Сентябрь 2026" */
export function formatMonthLabel(date: ISODate): string {
  const value = toDate(date);
  return `${MONTHS_NOMINATIVE[value.getMonth()]} ${value.getFullYear()}`;
}

/** "2026-09-18" → "18 сен" или "18 сентября" */
export function formatShortDate(date: ISODate, month: 'short' | 'long' = 'short'): string {
  const value = toDate(date);
  const monthName = MONTHS_GENITIVE[value.getMonth()]!;
  return `${value.getDate()} ${month === 'short' ? monthName.slice(0, 3) : monthName}`;
}

/** "2026-09-19" → "Сб, 19 сен" */
export function formatWeekdayDate(date: ISODate): string {
  return `${getShortWeekdayName(date)}, ${formatShortDate(date)}`;
}

/** Диапазон недели: "14–20 сентября", "28 сентября – 4 октября" */
export function formatWeekRange(weekStart: ISODate): string {
  const weekEnd = addDays(weekStart, 6);
  const start = toDate(weekStart);
  const end = toDate(weekEnd);

  if (start.getFullYear() !== end.getFullYear()) return `${formatFullDate(weekStart)} – ${formatFullDate(weekEnd)}`;
  if (start.getMonth() !== end.getMonth()) return `${formatShortDate(weekStart, 'long')} – ${formatShortDate(weekEnd, 'long')}`;
  return `${start.getDate()}–${end.getDate()} ${MONTHS_GENITIVE[end.getMonth()]}`;
}

/** Относительно сегодняшнего дня: "Сегодня", "Завтра", "Вчера" или "18 сен" */
export function formatDayLabel(date: ISODate, today: ISODate, month: 'short' | 'long' = 'short'): string {
  if (date === today) return 'Сегодня';
  if (date === addDays(today, 1)) return 'Завтра';
  if (date === addDays(today, -1)) return 'Вчера';
  return formatShortDate(date, month);
}

/** "09:50" → 590 — минуты от начала суток */
export function timeToMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Сколько минут от одного времени до другого: ("09:18", "10:00") → 42 */
export function minutesBetween(from: string, to: string): number {
  return timeToMinutes(to) - timeToMinutes(from);
}

/** 42 → "42 мин", 130 → "2 ч 10 мин" */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} мин`;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`;
}
