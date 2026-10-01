import { SquareCheck } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { List } from '../../components/ui/List';
import { pluralize } from '../../lib/pluralize';
import type { ISODate, Task } from '../../types/models';
import { sortTasks } from '../tasks/taskFilters';
import { TaskRow } from '../tasks/TaskRow';
import { TabToolbar } from './TabToolbar';

interface SubjectTasksTabProps {
  tasks: Task[];
  today: ISODate;
  onAdd: () => void;
  onEdit: (task: Task) => void;
}

/** Все задачи предмета, отсортированные по сроку. Выполненные показаны зачёркнутыми, а не скрыты. */
export function SubjectTasksTab({ tasks, today, onAdd, onEdit }: SubjectTasksTabProps) {
  const sorted = sortTasks(tasks, 'deadline');

  return (
    <>
      <TabToolbar label={pluralize(tasks.length, ['задача', 'задачи', 'задач'])} addLabel="Добавить задачу" onAdd={onAdd} personal />
      {sorted.length === 0 ? (
        <EmptyState
          icon={SquareCheck}
          title="Пока нет задач"
          description="Здесь появятся задачи этого предмета."
        />
      ) : (
        <List>
          {sorted.map((task) => (
            <TaskRow key={task.id} task={task} today={today} onEdit={onEdit} />
          ))}
        </List>
      )}
    </>
  );
}
