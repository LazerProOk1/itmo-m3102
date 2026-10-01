import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { M3102_SEMESTER } from '../../data/m3102';
import { storageKey } from '../../lib/storage';
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
      // v1: чётность недель по ИТМО (21.09.2026 — нечётная)
      version: 1,
      migrate: (persisted) => ({ ...(persisted as object), ...M3102_SEMESTER }) as SemesterSettingsStore,
    },
  ),
);
