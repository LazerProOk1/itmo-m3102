import { useState } from 'react';
import type { ID, LectureNote } from '../../types/models';
import type { LectureNoteDialogTarget } from './LectureNoteDialog';
import { useLectureNotesStore } from './lectureNotesStore';

/**
 * Какое окно конспекта открыто: создание нового (можно заранее задать предмет) или
 * редактирование существующего. Открытие существующего конспекта заодно отмечает его
 * как открытый (lastOpenedAt) — единая точка для всех мест, откуда открывается конспект.
 */
export function useLectureNoteDialog() {
  const [target, setTarget] = useState<LectureNoteDialogTarget | null>(null);
  const touchLectureNote = useLectureNotesStore((state) => state.touchLectureNote);

  return {
    target,
    openCreate: (defaultSubjectId?: ID) => setTarget({ mode: 'create', defaultSubjectId }),
    openEdit: (note: LectureNote) => {
      touchLectureNote(note.id);
      setTarget({ mode: 'edit', note });
    },
    close: () => setTarget(null),
  };
}
