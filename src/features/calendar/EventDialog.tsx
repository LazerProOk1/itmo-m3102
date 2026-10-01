import { Trash } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDeleteModal } from '../../components/ui/ConfirmDeleteModal';
import { Modal } from '../../components/ui/Modal';
import { useEditMode } from '../settings/EditModeContext';
import type { Event, ISODate } from '../../types/models';
import { EventForm, type EventFormValues } from './EventForm';
import { useEventsStore } from './eventsStore';
import styles from './EventDialog.module.css';

/** Что открыто в окне: новое событие (можно заранее задать дату) или редактирование существующего */
export type EventDialogTarget = { mode: 'create'; defaultDate?: ISODate } | { mode: 'edit'; event: Event };

const FORM_ID = 'event-form';

interface EventDialogProps {
  target: EventDialogTarget | null;
  onClose: () => void;
}

/** Создание и редактирование обычного события в одном модальном окне. */
export function EventDialog({ target, onClose }: EventDialogProps) {
  const { isEditMode } = useEditMode();
  const addEvent = useEventsStore((state) => state.addEvent);
  const updateEvent = useEventsStore((state) => state.updateEvent);
  const deleteEvent = useEventsStore((state) => state.deleteEvent);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isEditing = target?.mode === 'edit';

  function handleSubmit(values: EventFormValues) {
    if (!target) return;
    const draft = {
      title: values.title.trim(),
      date: values.date,
      startTime: values.startTime || undefined,
      endTime: values.endTime || undefined,
      description: values.description.trim() || undefined,
    };

    if (target.mode === 'edit') updateEvent(target.event.id, draft);
    else addEvent(draft);
    onClose();
  }

  function handleDelete() {
    if (target?.mode === 'edit') deleteEvent(target.event.id);
    setConfirmingDelete(false);
    onClose();
  }

  return (
    <>
      <Modal
        open={target !== null}
        onClose={onClose}
        title={!isEditMode && target?.mode === 'edit' ? target.event.title : isEditing ? 'Изменить событие' : 'Новое событие'}
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
                {isEditing ? 'Сохранить' : 'Создать событие'}
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
          <EventForm id={FORM_ID} initialValues={getInitialValues(target)} onSubmit={handleSubmit} disabled={!isEditMode} />
        )}
      </Modal>
      <ConfirmDeleteModal
        open={confirmingDelete}
        title={target?.mode === 'edit' ? target.event.title : ''}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}

function getInitialValues(target: EventDialogTarget): EventFormValues {
  if (target.mode === 'edit') {
    const { event } = target;
    return {
      title: event.title,
      date: event.date,
      startTime: event.startTime ?? '',
      endTime: event.endTime ?? '',
      description: event.description ?? '',
    };
  }
  return { title: '', date: target.defaultDate ?? '', startTime: '', endTime: '', description: '' };
}
