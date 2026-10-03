import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { M3102_SEMESTER } from '../../data/m3102';
import { localStore, storageKey } from '../../lib/storage';
import type { ISODate, TimeFormat } from '../../types/models';

export interface SemesterSettings {
  semesterStart: ISODate;
  /** Понедельник нечётной недели — от него считается чётность, см. lib/studyWeek.ts */
  weekOneStart: ISODate;
  timeFormat: TimeFormat;
}

interface SemesterSettingsStore extends SemesterSettings {
  updateSemesterSettings: (changes: Partial<SemesterSettings>) => void;
}

export const useSemesterSettingsStore = create<SemesterSettingsStore>()(
  persist(
    (set) => ({
      ...M3102_SEMESTER,
      timeFormat: '24h',
      updateSemesterSettings: (changes) => set(changes),
    }),
    {
      name: storageKey('semester'),
      storage: localStore,
      // v2: чётность как на сайте группы (21.09.2026 — чётная), дальше её задаёт синхронизация
      version: 2,
      migrate: (persisted) => ({ ...(persisted as object), ...M3102_SEMESTER }) as SemesterSettingsStore,
    },
  ),
);
