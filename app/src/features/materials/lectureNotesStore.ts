import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createEntity, replaceEntity } from '../../lib/entity';
import { idleStorage, storageKey } from '../../lib/storage';
import type { ID, LectureNote, LectureNoteContentType } from '../../types/models';

export interface LectureNoteDraft {
  subjectId: string;
  lectureNumber: string;
  title: string;
  contentType: LectureNoteContentType;
  content: string;
}

interface LectureNotesStore {
  lectureNotes: LectureNote[];
  addLectureNote: (draft: LectureNoteDraft) => void;
  updateLectureNote: (id: ID, draft: LectureNoteDraft) => void;
  deleteLectureNote: (id: ID) => void;
  /** Отмечает конспект как открытый — для блока «Продолжить чтение» */
  touchLectureNote: (id: ID) => void;
}

/** Конспекты лекций. Из репозитория группы приходят синхронизацией (source: 'github'). */
export const useLectureNotesStore = create<LectureNotesStore>()(
  persist(
    (set) => ({
      lectureNotes: [],
      addLectureNote: (draft) =>
        set((state) => ({ lectureNotes: [createEntity({ ...draft, source: 'manual' as const, archived: false }), ...state.lectureNotes] })),
      updateLectureNote: (id, draft) =>
        set((state) => ({
          lectureNotes: state.lectureNotes.map((note) =>
            note.id === id
              ? replaceEntity(note, draft, {
                  source: note.source,
                  sourceRef: note.sourceRef,
                  archived: note.archived,
                  lastOpenedAt: note.lastOpenedAt,
                })
              : note,
          ),
        })),
      deleteLectureNote: (id) => set((state) => ({ lectureNotes: state.lectureNotes.filter((note) => note.id !== id) })),
      touchLectureNote: (id) =>
        set((state) => ({
          lectureNotes: state.lectureNotes.map((note) => (note.id === id ? { ...note, lastOpenedAt: new Date().toISOString() } : note)),
        })),
    }),
    {
      name: storageKey('lecture-notes'),
      storage: idleStorage(),
      // v1: конспекты 1 потока (collection: 'stream') убраны с сайта — стираем их из сохранённого
      version: 1,
      migrate: (persisted) => {
        const saved = (persisted as { lectureNotes?: (LectureNote & { collection?: string })[] }).lectureNotes ?? [];
        return { lectureNotes: saved.filter((note) => note.collection !== 'stream') } as LectureNotesStore;
      },
    },
  ),
);
