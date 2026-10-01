import { useState } from 'react';
import type { ID, ISODate, Task } from '../../types/models';
import type { TaskDialogTarget } from './TaskDialog';

interface CreateDefaults {
  subjectId?: ID;
  deadline?: ISODate;
}

/** Какое окно задачи открыто: создание новой или редактирование существующей. */
export function useTaskDialog() {
  const [target, setTarget] = useState<TaskDialogTarget | null>(null);

  return {
    target,
    openCreate: (defaults?: CreateDefaults) =>
      setTarget({ mode: 'create', defaultSubjectId: defaults?.subjectId, defaultDeadline: defaults?.deadline }),
    openEdit: (task: Task) => setTarget({ mode: 'edit', task }),
    close: () => setTarget(null),
  };
}
