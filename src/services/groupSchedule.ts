import { M3102_CLASSES, resolveSubjectFolder } from '../data/m3102';
import { addDays, getWeekday } from '../lib/dates';
import type { ClassDetails, ClassSession, ClassType, ISODate, ScheduleException, WeekRepeat, Weekday } from '../types/models';

/**
 * Расписание с сайта группы — data/schedule.json в RedstoneLord/itmo-m3102:
 *   cycle[0..13] — 14 дней: 0–6 нечётная неделя (пн–вс), 7–13 чётная;
 *   anchorMonday + anchorParity — понедельник с известной чётностью;
 *   overrides["2026-09-25"] = { note, lessons } — день целиком заменяется этим списком.
 * Переводится в нашу модель: регулярные пары (неделя 1 = нечётная, 2 = чётная) + исключения.
 */

interface RawLesson {
  id?: string;
  start?: string;
  end?: string;
  time?: string;
  subject?: string;
  room?: string;
  teacher?: string;
  location?: string;
  kind?: string;
  break?: boolean;
}

interface RawSchedule {
  anchorMonday?: string;
  anchorParity?: string;
  defaultLocation?: string;
  cycle?: unknown;
  overrides?: Record<string, { note?: string; lessons?: RawLesson[] }>;
}

export interface GroupSchedule {
  classes: ClassSession[];
  exceptions: ScheduleException[];
  /** Понедельник нечётной недели — от него наша чётность (lib/studyWeek.ts) */
  weekOneStart: ISODate;
  /** Предметы из расписания, которых нет в приложении — их пары пропущены */
  unknownSubjects: string[];
}

const KINDS: Record<string, ClassType> = { lecture: 'lecture', practice: 'practice', lab: 'lab', seminar: 'seminar' };
const SYNC_TIME = '2026-09-01T00:00:00.000Z';

function times(lesson: RawLesson): [string, string] {
  const [legacyStart = '', legacyEnd = ''] = String(lesson.time ?? '').split(/[–—-]/);
  return [String(lesson.start || legacyStart).trim(), String(lesson.end || legacyEnd).trim()];
}

/** Тип пары: из kind, иначе — как в нашем расписании ИТМО (там типы проставлены по цветам), иначе практика */
function classType(kind: string | undefined, weekday: Weekday, start: string, subjectId: string): ClassType {
  if (kind && KINDS[kind]) return KINDS[kind];
  return M3102_CLASSES.find((item) => item.weekday === weekday && item.startTime === start && item.subjectId === subjectId)?.type ?? 'practice';
}

function toDetails(lesson: RawLesson, weekday: Weekday, defaultLocation: string, unknown: Set<string>): ClassDetails | null {
  if (lesson.break) return null;
  const subject = String(lesson.subject ?? '').trim();
  const subjectId = resolveSubjectFolder(subject);
  if (!subjectId) {
    if (subject) unknown.add(subject);
    return null;
  }
  const [startTime, endTime] = times(lesson);
  if (!/^\d{1,2}:\d{2}$/.test(startTime) || !/^\d{1,2}:\d{2}$/.test(endTime)) return null;
  return {
    subjectId,
    startTime,
    endTime,
    type: classType(lesson.kind, weekday, startTime, subjectId),
    room: lesson.room ? String(lesson.room) : undefined,
    building: String(lesson.location || defaultLocation) || undefined,
    teacher: String(lesson.teacher ?? ''),
  };
}

const sameClass = (a: ClassDetails, b: ClassDetails) =>
  a.subjectId === b.subjectId && a.startTime === b.startTime && a.endTime === b.endTime && a.room === b.room && a.teacher === b.teacher;

export function parseGroupSchedule(raw: unknown): GroupSchedule {
  const data = raw as RawSchedule;
  const cycle = data?.cycle;
  if (!Array.isArray(cycle) || cycle.length !== 14 || !/^\d{4}-\d{2}-\d{2}$/.test(data.anchorMonday ?? '')) {
    throw new Error('Неверный формат schedule.json');
  }
  const defaultLocation = String(data.defaultLocation ?? '');
  const unknown = new Set<string>();

  // 1. Регулярные пары: одинаковые в обеих неделях — «каждую неделю»
  const odd: (ClassSession & { sourceId: string })[] = [];
  const even: typeof odd = [];
  cycle.forEach((day: unknown, index) => {
    const weekday = ((index % 7) + 1) as Weekday;
    (Array.isArray(day) ? (day as RawLesson[]) : []).forEach((lesson, position) => {
      const details = toDetails(lesson, weekday, defaultLocation, unknown);
      if (!details) return;
      const sourceId = String(lesson.id || `cycle-${index + 1}-${position + 1}`);
      const session = { ...details, id: `gh:schedule:${sourceId}`, sourceId, weekday, weeks: 1 as WeekRepeat, createdAt: SYNC_TIME, updatedAt: SYNC_TIME };
      (index < 7 ? odd : even).push(session);
    });
  });

  const classes: ClassSession[] = [];
  const evenLeft = [...even];
  for (const session of odd) {
    const twin = evenLeft.findIndex((item) => item.weekday === session.weekday && sameClass(item, session));
    if (twin !== -1) evenLeft.splice(twin, 1);
    classes.push({ ...session, weeks: twin !== -1 ? 'every' : 1 });
  }
  for (const session of evenLeft) classes.push({ ...session, weeks: 2 });
  for (const session of classes) delete (session as Partial<{ sourceId: string }>).sourceId;

  // 2. Чётность: anchorMonday — неделя anchorParity; наша неделя 1 — нечётная
  const anchor = data.anchorMonday!;
  const weekOneStart = data.anchorParity === 'odd' ? anchor : addDays(anchor, -7);
  const isOddWeek = (date: ISODate) => Math.round((Date.parse(date) - Date.parse(weekOneStart)) / 604_800_000) % 2 === 0;

  // 3. Замены дня: отменяем пары, которых нет в новом списке, добавляем новые; совпадающие не трогаем
  const exceptions: ScheduleException[] = [];
  for (const [date, override] of Object.entries(data.overrides ?? {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(override?.lessons)) continue;
    const weekday = getWeekday(date);
    const weekStartMonday = addDays(date, 1 - weekday);
    const parity: WeekRepeat = isOddWeek(weekStartMonday) ? 1 : 2;
    const regular = classes.filter((item) => item.weekday === weekday && (item.weeks === 'every' || item.weeks === parity));
    const wanted = override.lessons.map((lesson) => toDetails(lesson, weekday, defaultLocation, unknown)).filter((item): item is ClassDetails => item !== null);
    const note = override.note ? String(override.note) : undefined;

    regular
      .filter((item) => !wanted.some((details) => sameClass(details, item)))
      .forEach((item) =>
        exceptions.push({ id: `gh:override:${date}:cancel:${item.id}`, kind: 'cancelled', classId: item.id, date, note, createdAt: SYNC_TIME, updatedAt: SYNC_TIME }),
      );
    wanted
      .filter((details) => !regular.some((item) => sameClass(details, item)))
      .forEach((details, index) =>
        exceptions.push({ id: `gh:override:${date}:add:${index}`, kind: 'additional', date, details, note, createdAt: SYNC_TIME, updatedAt: SYNC_TIME }),
      );
  }

  return { classes, exceptions, weekOneStart, unknownSubjects: [...unknown] };
}
