import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { replaceEntity } from '../../lib/entity';
import { storageKey } from '../../lib/storage';
import type { ID, SubjectInfo, SubjectInfoCategory } from '../../types/models';

export interface SubjectInfoDraft {
  title: string;
  content: string;
  category: SubjectInfoCategory;
}

interface SubjectInfoStore {
  items: SubjectInfo[];
  updateSubjectInfo: (id: ID, draft: SubjectInfoDraft) => void;
  deleteSubjectInfo: (id: ID) => void;
}

/** Нелекционный контент предметов (описание курса, правила, ссылки). */
export const useSubjectInfoStore = create<SubjectInfoStore>()(
  persist(
    (set) => ({
      items: [],
      updateSubjectInfo: (id, draft) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? replaceEntity(item, draft, { subjectId: item.subjectId, source: item.source, sourceRef: item.sourceRef, archived: item.archived })
              : item,
          ),
        })),
      deleteSubjectInfo: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
    }),
    { name: storageKey('subject-info') },
  ),
);
