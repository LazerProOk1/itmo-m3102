import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { M3102_CLASSES } from '../../data/m3102';
import { createEntity, replaceEntity } from '../../lib/entity';
import { storageKey } from '../../lib/storage';
import { useSemesterSettingsStore } from '../settings/semesterSettingsStore';
import type { ClassDetails, ClassSession, ID, ScheduleException, WeekRepeat, Weekday } from '../../types/models';
import type { ScheduleData } from './occurrences';

export interface ClassDraft extends ClassDetails {
  weekday: Weekday;
  weeks: WeekRepeat;
}

export type ExceptionDraft =
  | { kind: 'cancelled'; classId: ID; date: string; note?: string }
  | { kind: 'moved'; classId: ID; date: string; newDate: string; startTime: string; endTime: string; room?: string; teacherOverride?: string; note?: string }
  | { kind: 'replaced'; classId: ID; date: string; details: ClassDetails; note?: string }
  | { kind: 'additional'; date: string; details: ClassDetails; note?: string };

interface ScheduleStore {
  classes: ClassSession[];
  exceptions: ScheduleException[];
  addClass: (draft: ClassDraft) => void;
  updateClass: (id: ID, draft: ClassDraft) => void;
  /** Удаляет занятие вместе со всеми его исключениями */
  deleteClass: (id: ID) => void;
  /**
   * Создаёт исключение или обновляет существующее (если передан id).
   * У одного занятия в одну дату может быть только одно исключение — прежнее заменяется.
   */
  saveException: (draft: ExceptionDraft, id?: ID) => void;
  deleteException: (id: ID) => void;
}

export const useScheduleStore = create<ScheduleStore>()(
  persist(
    (set) => ({
      classes: M3102_CLASSES,
      exceptions: [],

      addClass: (draft) => set((state) => ({ classes: [...state.classes, createEntity(draft)] })),

      updateClass: (id, draft) =>
        set((state) => ({ classes: state.classes.map((session) => (session.id === id ? replaceEntity(session, draft) : session)) })),

      deleteClass: (id) =>
        set((state) => ({
          classes: state.classes.filter((session) => session.id !== id),
          exceptions: state.exceptions.filter((exception) => exception.kind === 'additional' || exception.classId !== id),
        })),

      saveException: (draft, id) =>
        set((state) => {
          const existing = id ? state.exceptions.find((exception) => exception.id === id) : undefined;
          const saved = (existing ? replaceEntity(existing, draft) : createEntity(draft)) as ScheduleException;
          const others = state.exceptions.filter(
            (exception) =>
              exception.id !== saved.id &&
              !(saved.kind !== 'additional' && exception.kind !== 'additional' && exception.classId === saved.classId && exception.date === saved.date),
          );
          return { exceptions: [...others, saved] };
        }),

      deleteException: (id) => set((state) => ({ exceptions: state.exceptions.filter((exception) => exception.id !== id) })),
    }),
    {
      name: storageKey('schedule'),
      // v2: запасное расписание с чётностью сайта группы; при синхронизации заменяется data/schedule.json
      version: 2,
      migrate: (persisted) => ({ ...(persisted as object), classes: M3102_CLASSES }) as ScheduleStore,
    },
  ),
);

/** Занятия, исключения и настройки семестра — всё для расчёта расписания */
export function useScheduleData(): ScheduleData {
  const classes = useScheduleStore((state) => state.classes);
  const exceptions = useScheduleStore((state) => state.exceptions);
  const semesterStart = useSemesterSettingsStore((state) => state.semesterStart);
  const weekOneStart = useSemesterSettingsStore((state) => state.weekOneStart);
  return { classes, exceptions, semesterStart, weekOneStart };
}
