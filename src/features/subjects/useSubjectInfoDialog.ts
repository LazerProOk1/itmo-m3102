import { useState } from 'react';
import type { SubjectInfo } from '../../types/models';

/** Только редактирование существующей записи — создаёт их лишь синхронизация с GitHub. */
export function useSubjectInfoDialog() {
  const [target, setTarget] = useState<SubjectInfo | null>(null);

  return {
    target,
    openEdit: (item: SubjectInfo) => setTarget(item),
    close: () => setTarget(null),
  };
}
