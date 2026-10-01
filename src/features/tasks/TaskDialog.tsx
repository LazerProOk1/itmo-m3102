import { Trash } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDeleteModal } from '../../components/ui/ConfirmDeleteModal';
import { Modal } from '../../components/ui/Modal';
import { useEditMode } from '../settings/EditModeContext';
import type { ID, ISODate, Task } from '../../types/models';
import { TaskForm, type TaskFormValues } from './TaskForm';
import type { TaskDraft } from './tasksStore';
import { useTasksStore } from './tasksStore';
import styles from './TaskDialog.module.css';

/** Что открыто в окне: новая задача (можно заранее задать предмет и/или срок) или редактирование существующей */
export type TaskDialogTarget =
  | { mode: 'create'; defaultSubjectId?: ID; defaultDeadline?: ISODate }
  | { mode: 'edit'; task: Task };

const FORM_ID = 'task-form';

interface TaskDialogProps {
  target: TaskDialogTarget | null;
  onClose: () => void;
}

/** Создание и редактирование задачи в одном модальном окне. */
export function TaskDialog({ target, onClose }: TaskDialogProps) {
  const { isEditMode } = useEditMode();
  const addTask = useTasksStore((state) => state.addTask);
  const updateTask = useTasksStore((state) => state.updateTask);
  const deleteTask = useTasksStore((state) => state.deleteTask);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isEditing = target?.mode === 'edit';

  function handleSubmit(values: TaskFormValues) {
    if (!target) return;
    const draft: TaskDraft = {
      title: values.title.trim(),
      subjectId: values.subjectId || undefined,
      type: values.type,
      deadline: values.deadline || undefined,
      priority: values.priority,
      status: values.status,
      description: values.description.trim() || undefined,
      links: values.links,
    };

    if (target.mode === 'edit') updateTask(target.task.id, draft);
    else addTask(draft);
    onClose();
  }

  function handleDelete() {
    if (target?.mode === 'edit') deleteTask(target.task.id);
    setConfirmingDelete(false);
    onClose();
  }

  return (
    <>
      <Modal
        open={target !== null}
        onClose={onClose}
        title={!isEditMode && target?.mode === 'edit' ? target.task.title : isEditing ? 'Изменить задачу' : 'Новая задача'}
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
                {isEditing ? 'Сохранить' : 'Создать задачу'}
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
          <TaskForm id={FORM_ID} initialValues={getInitialValues(target)} onSubmit={handleSubmit} disabled={!isEditMode} />
        )}
      </Modal>
      <ConfirmDeleteModal
        open={confirmingDelete}
        title={target?.mode === 'edit' ? target.task.title : ''}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}

function getInitialValues(target: TaskDialogTarget): TaskFormValues {
  if (target.mode === 'edit') {
    const { task } = target;
    return {
      title: task.title,
      subjectId: task.subjectId ?? '',
      type: task.type,
      deadline: task.deadline ?? '',
      priority: task.priority,
      status: task.status,
      description: task.description ?? '',
      links: task.links,
    };
  }

  return {
    title: '',
    subjectId: target.defaultSubjectId ?? '',
    type: 'homework',
    deadline: target.defaultDeadline ?? '',
    priority: 'normal',
    status: 'todo',
    description: '',
    links: [],
  };
}
