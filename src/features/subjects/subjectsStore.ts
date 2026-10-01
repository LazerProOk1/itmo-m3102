import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { M3102_SUBJECTS } from '../../data/m3102';
import { createEntity, replaceEntity } from '../../lib/entity';
import { storageKey } from '../../lib/storage';
import type { ID, Subject, SubjectContact } from '../../types/models';

export interface SubjectDraft {
  name: string;
  teacherPrimary?: string;
  telegramChatUrl?: string;
  contacts?: SubjectContact[];
}

interface SubjectsStore {
  subjects: Subject[];
  addSubject: (draft: SubjectDraft) => void;
  updateSubject: (id: ID, draft: SubjectDraft) => void;
  /**
   * Удаляет только сам предмет. Задачи, материалы, заметки и занятия, которые на него
   * ссылались, никуда не деваются — показываются как «без предмета».
   */
  deleteSubject: (id: ID) => void;
}

export const useSubjectsStore = create<SubjectsStore>()(
  persist(
    (set) => ({
      subjects: M3102_SUBJECTS,
      addSubject: (draft) => set((state) => ({ subjects: [...state.subjects, createEntity({ ...draft, archived: false })] })),
      updateSubject: (id, draft) =>
        set((state) => ({
          subjects: state.subjects.map((subject) =>
            subject.id === id ? replaceEntity(subject, draft, { archived: subject.archived }) : subject,
          ),
        })),
      deleteSubject: (id) => set((state) => ({ subjects: state.subjects.filter((subject) => subject.id !== id) })),
    }),
    {
      name: storageKey('subjects'),
      // v1: обновлённые преподаватели М3102 — предметы, добавленные вручную, сохраняются
      version: 1,
      migrate: (persisted) => {
        const seedIds = new Set(M3102_SUBJECTS.map((subject) => subject.id));
        const saved = (persisted as Partial<SubjectsStore>).subjects ?? [];
        return { subjects: [...M3102_SUBJECTS, ...saved.filter((subject) => !seedIds.has(subject.id))] } as SubjectsStore;
      },
    },
  ),
);

/** Название предмета по id. Компонент перерисуется, если название изменится. Для случаев, где предмет обязателен. */
export function useSubjectName(id: ID | undefined): string {
  return useSubjectsStore(
    (state) => state.subjects.find((subject) => subject.id === id)?.name ?? 'Неизвестный предмет',
  );
}

/**
 * Название предмета, если он указан и существует, иначе undefined.
 * Для необязательных ссылок на предмет (например, Task.subjectId).
 */
export function useOptionalSubjectName(id: ID | undefined): string | undefined {
  return useSubjectsStore((state) => state.subjects.find((subject) => subject.id === id)?.name);
}
