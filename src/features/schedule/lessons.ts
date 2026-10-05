import { addDays } from '../../lib/dates';
import type { ClassType, ISODate } from '../../types/models';
import { getOccurrencesForDate, takesPlace, type ClassOccurrence, type ScheduleData } from './occurrences';

/**
 * Связь пары и конспекта: у группы конспекты лежат по папкам «Лекция_3», «Практика_2», «Лекция_2-3» — номер
 * занятия этого вида по предмету с начала семестра. Считаем прошедшие пары (без отменённых и перенесённых отсюда)
 * так же — и находим, к какой паре конспект и какой конспект у пары.
 */
export type LessonKind = 'Лекция' | 'Практика';

/** Семинар у группы — та же «Практика»; лабораторные в папки конспектов не кладут */
const KINDS: Partial<Record<ClassType, LessonKind>> = { lecture: 'Лекция', practice: 'Практика', seminar: 'Практика' };

export const lessonKind = (type: ClassType) => KINDS[type];

/** Пары предмета этого вида по порядку — с начала семестра до `until` включительно */
function lessonsOf(subjectId: string, kind: LessonKind, until: ISODate, data: ScheduleData): ClassOccurrence[] {
  const result: ClassOccurrence[] = [];
  for (let date = data.semesterStart; date <= until; date = addDays(date, 1)) {
    for (const item of getOccurrencesForDate(date, data))
      if (takesPlace(item) && item.details.subjectId === subjectId && lessonKind(item.details.type) === kind) result.push(item);
  }
  return result;
}

/** Номер пары среди пар того же вида по предмету: третья лекция по ДМ → { kind: 'Лекция', n: 3 } */
export function lessonNumber(occurrence: ClassOccurrence, data: ScheduleData): { kind: LessonKind; n: number } | undefined {
  const kind = lessonKind(occurrence.details.type);
  if (!kind) return undefined;
  const index = lessonsOf(occurrence.details.subjectId, kind, occurrence.date, data).findIndex((item) => item.key === occurrence.key);
  return index < 0 ? undefined : { kind, n: index + 1 };
}

/** «Лекция 2-3» → { kind: 'Лекция', from: 2, to: 3 }; «Доп Материалы» — не занятие */
export function parseLessonLabel(label: string): { kind: LessonKind; from: number; to: number } | undefined {
  const match = /^(Лекция|Практика)\s+(\d+)(?:-(\d+))?$/u.exec(label.trim());
  if (!match) return undefined;
  const from = Number(match[2]);
  return { kind: match[1] as LessonKind, from, to: match[3] ? Number(match[3]) : from };
}

/** Подходит ли папка конспекта к паре: «Лекция 2-3» — и ко второй, и к третьей лекции */
export function labelMatches(label: string, lesson: { kind: LessonKind; n: number }): boolean {
  const parsed = parseLessonLabel(label);
  return Boolean(parsed && parsed.kind === lesson.kind && lesson.n >= parsed.from && lesson.n <= parsed.to);
}

/** Когда была (или будет) пара к конспекту «Лекция 3»: дата той пары, ищем до `horizon` */
export function lessonDate(subjectId: string, label: string, data: ScheduleData, horizon: ISODate): ISODate | undefined {
  const parsed = parseLessonLabel(label);
  if (!parsed) return undefined;
  return lessonsOf(subjectId, parsed.kind, horizon, data)[parsed.from - 1]?.date;
}
