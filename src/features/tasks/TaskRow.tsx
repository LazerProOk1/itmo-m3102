import { Ellipsis, Pencil, Trash } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Checkbox } from '../../components/ui/Checkbox';
import { ConfirmDeleteModal, useConfirmDelete } from '../../components/ui/ConfirmDeleteModal';
import { DropdownItem, DropdownMenu, DropdownSeparator } from '../../components/ui/DropdownMenu';
import { IconButton } from '../../components/ui/IconButton';
import { ListItem } from '../../components/ui/List';
import { cn } from '../../lib/cn';
import { formatDayLabel } from '../../lib/dates';
import type { ISODate, Task, TaskStatus } from '../../types/models';
import { useOptionalSubjectName } from '../subjects/subjectsStore';
import { formatTaskMeta, STATUSES } from './labels';
import { PriorityBadge } from './PriorityBadge';
import { StatusBadge } from './StatusBadge';
import { useTasksStore } from './tasksStore';
import styles from './TaskRow.module.css';

interface TaskRowProps {
  task: Task;
  today: ISODate;
  onEdit: (task: Task) => void;
}

const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done'];

/** Пауза между «галочка нарисована» и фактическим уходом задачи из списка */
const DONE_COMMIT_DELAY = 550;

/**
 * Строка задачи: чекбокс для быстрого «выполнено», кликабельное название открывает
 * редактирование, статус/приоритет/срок справа, меню — полный набор действий.
 * Используется на Tasks, Deadlines и Today.
 */
export function TaskRow({ task, today, onEdit }: TaskRowProps) {
  const subjectName = useOptionalSubjectName(task.subjectId);
  const setStatus = useTasksStore((state) => state.setStatus);
  const toggleDone = useTasksStore((state) => state.toggleDone);
  const deleteTask = useTasksStore((state) => state.deleteTask);
  const confirmDelete = useConfirmDelete<Task>();

  // Отмечено локально сразу по клику — галочка и зачёркивание играют, не дожидаясь
  // реального изменения статуса. Само изменение (и, если список это скрывает, уход
  // строки из списка) откладывается на DONE_COMMIT_DELAY, чтобы анимацию было видно.
  const [optimisticDone, setOptimisticDone] = useState(task.status === 'done');
  const commitTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => setOptimisticDone(task.status === 'done'), [task.status]);
  useEffect(() => () => clearTimeout(commitTimeout.current), []);

  function handleToggle() {
    clearTimeout(commitTimeout.current);
    if (task.status === 'done') {
      toggleDone(task.id);
      return;
    }
    setOptimisticDone(true);
    commitTimeout.current = setTimeout(() => toggleDone(task.id), DONE_COMMIT_DELAY);
  }

  const isDone = optimisticDone;
  const isOverdue = !isDone && task.deadline !== undefined && task.deadline < today;

  return (
    <>
      <ListItem
        muted={isDone}
        leading={
          <Checkbox
            celebrate
            checked={isDone}
            onChange={handleToggle}
            aria-label={`${isDone ? 'Отметить как невыполненное' : 'Отметить как выполненное'}: ${task.title}`}
          />
        }
        title={
          <button type="button" className={styles.titleButton} onClick={() => onEdit(task)}>
            <span className={cn(styles.titleText, isDone && styles.doneTitle)}>{task.title}</span>
          </button>
        }
        meta={formatTaskMeta(subjectName, task.type)}
        trailing={
          <>
            <StatusBadge status={task.status} />
            {!isDone && <PriorityBadge priority={task.priority} />}
            {task.deadline && <span className={cn(styles.due, isOverdue && styles.overdue)}>{formatDayLabel(task.deadline, today)}</span>}
            <DropdownMenu align="end" trigger={(props) => <IconButton icon={Ellipsis} label="Действия с задачей" size="sm" {...props} />}>
              {STATUS_ORDER.map((status) => (
                <DropdownItem key={status} icon={STATUSES[status].icon} checked={task.status === status} onSelect={() => setStatus(task.id, status)}>
                  {STATUSES[status].label}
                </DropdownItem>
              ))}
              <DropdownSeparator />
              <DropdownItem icon={Pencil} onSelect={() => onEdit(task)}>
                Изменить
              </DropdownItem>
              <DropdownItem icon={Trash} onSelect={() => confirmDelete.request(task)}>
                Удалить
              </DropdownItem>
            </DropdownMenu>
          </>
        }
      />
      <ConfirmDeleteModal
        open={confirmDelete.target !== null}
        title={confirmDelete.target?.title ?? ''}
        onCancel={confirmDelete.cancel}
        onConfirm={() => {
          if (confirmDelete.target) deleteTask(confirmDelete.target.id);
          confirmDelete.cancel();
        }}
      />
    </>
  );
}
