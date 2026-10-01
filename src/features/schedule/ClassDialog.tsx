import { Trash } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDeleteModal } from '../../components/ui/ConfirmDeleteModal';
import { Modal } from '../../components/ui/Modal';
import type { SegmentedOption } from '../../components/ui/SegmentedControl';
import { getWeekday } from '../../lib/dates';
import { useEditMode } from '../settings/EditModeContext';
import { useSubjectName } from '../subjects/subjectsStore';
import type { AdditionalClass, ClassDetails, ClassSession, ISODate, WeekRepeat } from '../../types/models';
import { ClassForm, type ClassFormValues, type RepeatOption } from './ClassForm';
import { useScheduleStore } from './scheduleStore';
import styles from './ClassDialog.module.css';

/** Что открыто в окне: новое занятие, еженедельное занятие или разовое */
export type ClassDialogTarget =
  | { mode: 'create'; date: ISODate }
  | { mode: 'editClass'; session: ClassSession }
  | { mode: 'editAdditional'; exception: AdditionalClass };

const FORM_ID = 'class-form';

const REPEAT_OPTIONS: SegmentedOption<RepeatOption>[] = [
  { value: 'every', label: 'Каждую неделю' },
  { value: '1', label: 'Нечётная' },
  { value: '2', label: 'Чётная' },
  { value: 'once', label: 'Один раз' },
];

/** WeekRepeat ('every' | 1 | 2) → RepeatOption формы ('every' | '1' | '2') */
function weeksToRepeatOption(weeks: WeekRepeat): RepeatOption {
  return weeks === 'every' ? 'every' : (String(weeks) as RepeatOption);
}

/** RepeatOption формы → WeekRepeat для сохранения. 'once' сюда не попадает — обрабатывается отдельно. */
function repeatOptionToWeeks(repeat: Exclude<RepeatOption, 'once'>): WeekRepeat {
  return repeat === 'every' ? 'every' : (Number(repeat) as 1 | 2);
}

const TITLES: Record<ClassDialogTarget['mode'], string> = {
  create: 'Добавить пару',
  editClass: 'Изменить еженедельную пару',
  editAdditional: 'Изменить разовую пару',
};

interface ClassDialogProps {
  target: ClassDialogTarget | null;
  onClose: () => void;
}

export function ClassDialog({ target, onClose }: ClassDialogProps) {
  const { isEditMode } = useEditMode();
  const addClass = useScheduleStore((state) => state.addClass);
  const updateClass = useScheduleStore((state) => state.updateClass);
  const deleteClass = useScheduleStore((state) => state.deleteClass);
  const saveException = useScheduleStore((state) => state.saveException);
  const deleteException = useScheduleStore((state) => state.deleteException);

  const isEditing = target !== null && target.mode !== 'create';
  const viewSubjectId =
    target?.mode === 'editClass'
      ? target.session.subjectId
      : target?.mode === 'editAdditional'
        ? target.exception.details.subjectId
        : undefined;
  const viewSubjectName = useSubjectName(viewSubjectId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleSubmit(values: ClassFormValues) {
    if (!target) return;
    const details = toDetails(values);

    if (values.repeat === 'once') {
      // Разовое занятие хранится как исключение вида «additional»
      const existingId = target.mode === 'editAdditional' ? target.exception.id : undefined;
      saveException({ kind: 'additional', date: values.date, details }, existingId);
    } else if (target.mode === 'editClass') {
      updateClass(target.session.id, { ...details, weekday: values.weekday, weeks: repeatOptionToWeeks(values.repeat) });
    } else {
      addClass({ ...details, weekday: values.weekday, weeks: repeatOptionToWeeks(values.repeat) });
    }
    onClose();
  }

  function handleDelete() {
    if (target?.mode === 'editClass') deleteClass(target.session.id);
    if (target?.mode === 'editAdditional') deleteException(target.exception.id);
    setConfirmingDelete(false);
    onClose();
  }

  return (
    <>
      <Modal
        open={target !== null}
        onClose={onClose}
        title={!isEditMode && target && target.mode !== 'create' ? viewSubjectName : target ? TITLES[target.mode] : ''}
        description={
          isEditMode && target?.mode === 'editClass'
            ? 'Изменения применятся ко всем неделям. Чтобы изменить одну дату, используйте меню пары.'
            : undefined
        }
        footer={
          isEditMode ? (
            <>
              {isEditing && (
                <Button variant="danger" icon={Trash} className={styles.delete} onClick={() => setConfirmingDelete(true)}>
                  Удалить
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>
                Отмена
              </Button>
              <Button variant="primary" type="submit" form={FORM_ID}>
                {isEditing ? 'Сохранить' : 'Добавить пару'}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Закрыть
            </Button>
          )
        }
      >
        {target && (
          <ClassForm
            id={FORM_ID}
            initialValues={getInitialValues(target)}
            repeatOptions={getRepeatOptions(target)}
            onSubmit={handleSubmit}
            disabled={!isEditMode}
          />
        )}
      </Modal>
      <ConfirmDeleteModal
        open={confirmingDelete}
        title={isEditing ? viewSubjectName : ''}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}

/** Еженедельное занятие нельзя превратить в разовое и наоборот */
function getRepeatOptions(target: ClassDialogTarget): SegmentedOption<RepeatOption>[] {
  if (target.mode === 'create') return REPEAT_OPTIONS;
  if (target.mode === 'editClass') return REPEAT_OPTIONS.filter((option) => option.value !== 'once');
  return [];
}

function getInitialValues(target: ClassDialogTarget): ClassFormValues {
  switch (target.mode) {
    case 'create':
      return {
        subjectId: '',
        repeat: 'every',
        weekday: getWeekday(target.date),
        date: target.date,
        startTime: '10:00',
        endTime: '11:30',
        type: 'lecture',
        room: '',
        building: '',
        teacher: '',
        subgroup: '',
        link: '',
        notes: '',
      };
    case 'editClass':
      return {
        ...toFormFields(target.session),
        repeat: weeksToRepeatOption(target.session.weeks),
        weekday: target.session.weekday,
        date: '',
      };
    case 'editAdditional':
      return {
        ...toFormFields(target.exception.details),
        repeat: 'once',
        weekday: getWeekday(target.exception.date),
        date: target.exception.date,
      };
  }
}

function toFormFields(details: ClassDetails) {
  return {
    subjectId: details.subjectId,
    startTime: details.startTime,
    endTime: details.endTime,
    type: details.type,
    room: details.room ?? '',
    building: details.building ?? '',
    teacher: details.teacher,
    subgroup: details.subgroup ?? '',
    link: details.link ?? '',
    notes: details.notes ?? '',
  };
}

/** Пустые необязательные поля не сохраняем; преподаватель обязателен */
function toDetails(values: ClassFormValues): ClassDetails {
  return {
    subjectId: values.subjectId,
    startTime: values.startTime,
    endTime: values.endTime,
    type: values.type,
    room: values.room.trim() || undefined,
    building: values.building.trim() || undefined,
    teacher: values.teacher.trim(),
    subgroup: values.subgroup.trim() || undefined,
    link: values.link.trim() || undefined,
    notes: values.notes.trim() || undefined,
  };
}
