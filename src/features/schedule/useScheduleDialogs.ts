import { useState } from 'react';
import type { ISODate } from '../../types/models';
import { useSubjectName } from '../subjects/subjectsStore';
import type { ClassDialogTarget } from './ClassDialog';
import type { ExceptionDialogTarget } from './ExceptionDialog';
import { CLASS_TYPE_LABELS } from './labels';
import type { OccurrenceAction } from './OccurrenceMenuItems';
import type { ClassOccurrence } from './occurrences';
import { useScheduleStore } from './scheduleStore';

/** Какое окно расписания открыто и что делать при выборе пункта в меню занятия */
export function useScheduleDialogs() {
  const classes = useScheduleStore((state) => state.classes);
  const saveException = useScheduleStore((state) => state.saveException);
  const deleteException = useScheduleStore((state) => state.deleteException);

  const [classTarget, setClassTarget] = useState<ClassDialogTarget | null>(null);
  const [exceptionTarget, setExceptionTarget] = useState<ExceptionDialogTarget | null>(null);
  // Удаление разовой пары («restore» для additional) — единственный «restore», который
  // безвозвратно стирает занятие целиком, а не просто возвращает обычное расписание
  const [deleteTarget, setDeleteTarget] = useState<ClassOccurrence | null>(null);
  const deleteTargetSubjectName = useSubjectName(deleteTarget?.details.subjectId);
  const deleteConfirmTitle = deleteTarget ? `${deleteTargetSubjectName} — ${CLASS_TYPE_LABELS[deleteTarget.details.type]}` : '';

  function openNewClass(date: ISODate) {
    setClassTarget({ mode: 'create', date });
  }

  function handleAction(action: OccurrenceAction, occurrence: ClassOccurrence) {
    const { exception } = occurrence;

    switch (action) {
      case 'editClass': {
        const session = classes.find((item) => item.id === occurrence.classId);
        if (session) setClassTarget({ mode: 'editClass', session });
        break;
      }
      case 'cancel':
        if (occurrence.classId) {
          saveException({ kind: 'cancelled', classId: occurrence.classId, date: occurrence.date });
        }
        break;
      case 'move':
        setExceptionTarget({ kind: 'moved', occurrence });
        break;
      case 'replace':
        setExceptionTarget({ kind: 'replaced', occurrence });
        break;
      case 'editException':
        if (exception?.kind === 'additional') setClassTarget({ mode: 'editAdditional', exception });
        if (exception?.kind === 'moved' || exception?.kind === 'replaced') {
          setExceptionTarget({ kind: exception.kind, occurrence });
        }
        break;
      case 'restore':
        if (exception?.kind === 'additional') setDeleteTarget(occurrence);
        else if (exception) deleteException(exception.id);
        break;
    }
  }

  return {
    classTarget,
    exceptionTarget,
    deleteConfirmTitle,
    isDeleteConfirmOpen: deleteTarget !== null,
    openNewClass,
    handleAction,
    closeClassDialog: () => setClassTarget(null),
    closeExceptionDialog: () => setExceptionTarget(null),
    cancelDelete: () => setDeleteTarget(null),
    confirmDelete: () => {
      if (deleteTarget?.exception) deleteException(deleteTarget.exception.id);
      setDeleteTarget(null);
    },
  };
}
