import { addDays, getWeekday } from '../../lib/dates';
import { getStudyWeek } from '../../lib/studyWeek';
import type { ClassDetails, ClassSession, ID, ISODate, ScheduleException } from '../../types/models';

/** Всё, что нужно для расчёта расписания */
export interface ScheduleData {
  classes: ClassSession[];
  exceptions: ScheduleException[];
  semesterStart: ISODate;
  weekOneStart: ISODate;
}

/**
 * regular    — обычное занятие
 * cancelled  — отменено
 * movedAway  — перенесено с этой даты (показываем бледным)
 * movedHere  — перенесено на эту дату
 * replaced   — вместо регулярного проходит другое занятие
 * additional — дополнительное разовое занятие
 */
export type OccurrenceStatus = 'regular' | 'cancelled' | 'movedAway' | 'movedHere' | 'replaced' | 'additional';

/** Занятие в конкретный день — результат наложения исключений на регулярное расписание */
export interface ClassOccurrence {
  /** Уникальный ключ для списков React */
  key: string;
  date: ISODate;
  status: OccurrenceStatus;
  /** Что показывать: предмет, время, аудитория... */
  details: ClassDetails;
  /** Регулярное занятие, к которому относится (нет только у additional) */
  classId?: ID;
  exception?: ScheduleException;
  /** Для movedAway и movedHere — вторая сторона переноса */
  move?: { date: ISODate; startTime: string };
}

/** Один день с его занятиями */
export interface DaySchedule {
  date: ISODate;
  occurrences: ClassOccurrence[];
}

/** Исключение, которое относится к регулярному занятию */
type ClassException = Exclude<ScheduleException, { kind: 'additional' }>;

/** Проходит ли занятие на самом деле: не отменено и не перенесено отсюда */
export function takesPlace(occurrence: ClassOccurrence): boolean {
  return occurrence.status !== 'cancelled' && occurrence.status !== 'movedAway';
}

/** Идёт ли занятие прямо сейчас */
export function isHappeningNow(occurrence: ClassOccurrence, today: ISODate, time: string): boolean {
  return (
    takesPlace(occurrence) &&
    occurrence.date === today &&
    occurrence.details.startTime <= time &&
    time < occurrence.details.endTime
  );
}

/** Дата, которую меняет исключение. Для перенесённого занятия — исходная, а не новая. */
export function getChangeDate(occurrence: ClassOccurrence): ISODate {
  const { exception } = occurrence;
  return exception && exception.kind !== 'additional' ? exception.date : occurrence.date;
}

/** Летние каникулы (июль–август) — регулярных пар нет, как на сайте группы */
export function isVacation(date: ISODate): boolean {
  const month = Number(date.slice(5, 7));
  return month === 7 || month === 8;
}

/** Ближайший день после `date`, когда есть пара по предмету — срок ДЗ «к следующей паре» */
export function nextClassDate(subjectId: string, date: ISODate, data: ScheduleData, limit = 60): ISODate | undefined {
  for (let offset = 1; offset <= limit; offset++) {
    const day = addDays(date, offset);
    if (getOccurrencesForDate(day, data).some((item) => takesPlace(item) && item.details.subjectId === subjectId)) return day;
  }
  return undefined;
}

/**
 * Занятия на дату, отсортированные по времени.
 * Исключения (отмена, перенос, замена, дополнительное занятие) всегда важнее регулярного расписания.
 */
export function getOccurrencesForDate(date: ISODate, data: ScheduleData): ClassOccurrence[] {
  const { classes, exceptions, semesterStart, weekOneStart } = data;
  const week = getStudyWeek(date, semesterStart, weekOneStart);
  const weekday = getWeekday(date);
  const occurrences: ClassOccurrence[] = [];

  // 1. Регулярные занятия — только с начала семестра и не на каникулах, с учётом чётности недели
  if (week.number >= 1 && !isVacation(date)) {
    for (const session of classes) {
      const matchesWeek = session.weeks === 'every' || session.weeks === week.weekInCycle;
      if (session.weekday !== weekday || !matchesWeek) continue;
      occurrences.push(applyException(session, date, findException(exceptions, session.id, date)));
    }
  }

  // 2. Занятия, перенесённые на эту дату, и дополнительные занятия
  for (const exception of exceptions) {
    if (exception.kind === 'moved' && exception.newDate === date) {
      const session = classes.find((item) => item.id === exception.classId);
      if (!session) continue;

      occurrences.push({
        key: `${exception.id}:moved-here`,
        date,
        status: 'movedHere',
        classId: session.id,
        exception,
        details: {
          ...toDetails(session),
          startTime: exception.startTime,
          endTime: exception.endTime,
          room: exception.room ?? session.room,
          teacher: exception.teacherOverride ?? session.teacher,
        },
        move: { date: exception.date, startTime: session.startTime },
      });
    }

    if (exception.kind === 'additional' && exception.date === date) {
      occurrences.push({ key: exception.id, date, status: 'additional', exception, details: exception.details });
    }
  }

  return occurrences.sort((a, b) => a.details.startTime.localeCompare(b.details.startTime));
}

function findException(exceptions: ScheduleException[], classId: ID, date: ISODate): ClassException | undefined {
  return exceptions.find(
    (exception): exception is ClassException =>
      exception.kind !== 'additional' && exception.classId === classId && exception.date === date,
  );
}

function applyException(session: ClassSession, date: ISODate, exception: ClassException | undefined): ClassOccurrence {
  const occurrence: ClassOccurrence = {
    key: `${session.id}:${date}`,
    date,
    status: 'regular',
    classId: session.id,
    details: toDetails(session),
  };

  if (!exception) return occurrence;

  switch (exception.kind) {
    case 'cancelled':
      return { ...occurrence, status: 'cancelled', exception };
    case 'moved':
      return {
        ...occurrence,
        status: 'movedAway',
        exception,
        move: { date: exception.newDate, startTime: exception.startTime },
      };
    case 'replaced':
      return { ...occurrence, status: 'replaced', exception, details: exception.details };
  }
}

function toDetails(session: ClassSession): ClassDetails {
  return {
    subjectId: session.subjectId,
    startTime: session.startTime,
    endTime: session.endTime,
    type: session.type,
    room: session.room,
    building: session.building,
    teacher: session.teacher,
    subgroup: session.subgroup,
    link: session.link,
    notes: session.notes,
  };
}
