import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { formatWeekdayDate } from '../../lib/dates';
import { useEditMode } from '../settings/EditModeContext';
import type { ClassSession } from '../../types/models';
import { ExceptionForm, type ExceptionFormValues } from './ExceptionForm';
import { getChangeDate, type ClassOccurrence } from './occurrences';
import { useScheduleStore } from './scheduleStore';

/** Перенос или замена одного занятия */
export interface ExceptionDialogTarget {
  kind: 'moved' | 'replaced';
  occurrence: ClassOccurrence;
}

const FORM_ID = 'exception-form';

interface ExceptionDialogProps {
  target: ExceptionDialogTarget | null;
  onClose: () => void;
}

export function ExceptionDialog({ target, onClose }: ExceptionDialogProps) {
  const { isEditMode } = useEditMode();
  const classes = useScheduleStore((state) => state.classes);
  const saveException = useScheduleStore((state) => state.saveException);

  const session = target ? classes.find((item) => item.id === target.occurrence.classId) : undefined;
  const changeDate = target ? getChangeDate(target.occurrence) : '';

  function handleSubmit(values: ExceptionFormValues) {
    if (!target || !session) return;

    // Если у занятия уже есть изменение того же вида — обновляем его
    const { exception } = target.occurrence;
    const existingId = exception?.kind === target.kind ? exception.id : undefined;
    const note = values.note.trim() || undefined;
    const room = values.room.trim() || undefined;

    if (target.kind === 'moved') {
      saveException(
        {
          kind: 'moved',
          classId: session.id,
          date: changeDate,
          newDate: values.newDate,
          startTime: values.startTime,
          endTime: values.endTime,
          room,
          teacherOverride: values.teacher.trim() || undefined,
          note,
        },
        existingId,
      );
    } else {
      saveException(
        {
          kind: 'replaced',
          classId: session.id,
          date: changeDate,
          note,
          details: {
            subjectId: values.subjectId,
            type: values.type,
            startTime: values.startTime,
            endTime: values.endTime,
            room,
            teacher: values.teacher.trim(),
          },
        },
        existingId,
      );
    }
    onClose();
  }

  return (
    <Modal
      open={target !== null && session !== undefined}
      onClose={onClose}
      title={target?.kind === 'moved' ? 'Перенос пары' : 'Замена пары'}
      description={changeDate ? `Только ${formatWeekdayDate(changeDate)}. Еженедельное расписание не меняется.` : undefined}
      footer={
        isEditMode ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="primary" type="submit" form={FORM_ID}>
              Сохранить
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        )
      }
    >
      {target && session && (
        <ExceptionForm
          id={FORM_ID}
          kind={target.kind}
          initialValues={getInitialValues(target, session)}
          onSubmit={handleSubmit}
          disabled={!isEditMode}
        />
      )}
    </Modal>
  );
}

/** Значения по умолчанию: из существующего изменения или из регулярного занятия */
function getInitialValues(target: ExceptionDialogTarget, session: ClassSession): ExceptionFormValues {
  const { exception, date } = target.occurrence;

  const values: ExceptionFormValues = {
    newDate: date,
    subjectId: session.subjectId,
    type: session.type,
    startTime: session.startTime,
    endTime: session.endTime,
    room: session.room ?? '',
    // Для замены преподаватель обязателен — подставляем текущего как отправную точку.
    // Для переноса это необязательное переопределение — пусто, если ещё не задано.
    teacher: target.kind === 'replaced' ? session.teacher : '',
    note: exception?.note ?? '',
  };

  if (exception?.kind === 'moved') {
    return {
      ...values,
      newDate: exception.newDate,
      startTime: exception.startTime,
      endTime: exception.endTime,
      room: exception.room ?? '',
      teacher: exception.teacherOverride ?? '',
    };
  }

  if (exception?.kind === 'replaced') {
    const { details } = exception;
    return {
      ...values,
      subjectId: details.subjectId,
      type: details.type,
      startTime: details.startTime,
      endTime: details.endTime,
      room: details.room ?? '',
      teacher: details.teacher,
    };
  }

  return values;
}
