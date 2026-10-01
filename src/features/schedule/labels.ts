import type { BadgeTone } from '../../components/ui/Badge';
import type { DropdownOption } from '../../components/ui/Dropdown';
import { formatWeekdayDate } from '../../lib/dates';
import type { ClassType } from '../../types/models';
import type { ClassOccurrence, OccurrenceStatus } from './occurrences';

export const CLASS_TYPE_LABELS: Record<ClassType, string> = {
  lecture: 'Лекция',
  lab: 'Лабораторная',
  seminar: 'Семинар',
  practice: 'Практика',
};

export const CLASS_TYPE_OPTIONS: DropdownOption[] = Object.entries(CLASS_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** Цвет по типу занятия — полоска слева от карточки и бейдж типа. Семинар делит цвет с консультацией/другим. */
export const CLASS_TYPE_TONES: Record<ClassType, BadgeTone> = {
  lecture: 'lecture',
  practice: 'practice',
  lab: 'lab',
  seminar: 'consultation',
};

/** CSS-переменная цвета типа занятия — для полоски слева и точек в календаре */
export function classTypeColorVar(type: ClassType): string {
  return `var(--color-${CLASS_TYPE_TONES[type]})`;
}

/** value — номер дня недели: "1" — понедельник … "7" — воскресенье */
export const WEEKDAY_OPTIONS: DropdownOption[] = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
].map((label, index) => ({ value: String(index + 1), label }));

/** Метки занятий, изменённых исключениями. У обычного занятия метки нет. */
export const OCCURRENCE_BADGES: Partial<Record<OccurrenceStatus, { label: string; tone: BadgeTone }>> = {
  cancelled: { label: 'Отменено', tone: 'danger' },
  movedAway: { label: 'Перенесено', tone: 'warning' },
  movedHere: { label: 'Перенесено', tone: 'warning' },
  replaced: { label: 'Замена', tone: 'neutral' },
  additional: { label: 'Разовое', tone: 'success' },
};

/** "Перенесено на Сб, 19 сен в 10:00" или "Перенесено с Чт, 17 сен в 10:00" */
export function describeMove(occurrence: ClassOccurrence): string | undefined {
  if (!occurrence.move) return undefined;
  const direction = occurrence.status === 'movedAway' ? 'на' : 'с';
  return `Перенесено ${direction} ${formatWeekdayDate(occurrence.move.date)} в ${occurrence.move.startTime}`;
}
