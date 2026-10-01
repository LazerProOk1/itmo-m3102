import { useState } from 'react';
import type { ID, Note } from '../../types/models';
import type { NoteDialogTarget } from './NoteDialog';

/** Какое окно заметки открыто: создание новой (можно заранее задать предмет) или редактирование существующей. */
export function useNoteDialog() {
  const [target, setTarget] = useState<NoteDialogTarget | null>(null);

  return {
    target,
    openCreate: (defaultSubjectId?: ID) => setTarget({ mode: 'create', defaultSubjectId }),
    openEdit: (note: Note) => setTarget({ mode: 'edit', note }),
    close: () => setTarget(null),
  };
}
