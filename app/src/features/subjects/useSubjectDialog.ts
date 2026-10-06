import { useState } from 'react';
import type { Subject } from '../../types/models';
import type { SubjectDialogTarget } from './SubjectDialog';

/** Какое окно предмета открыто: создание нового или редактирование существующего. */
export function useSubjectDialog() {
  const [target, setTarget] = useState<SubjectDialogTarget | null>(null);

  return {
    target,
    openCreate: () => setTarget({ mode: 'create' }),
    openEdit: (subject: Subject) => setTarget({ mode: 'edit', subject }),
    close: () => setTarget(null),
  };
}
