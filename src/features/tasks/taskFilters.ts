import { addDays } from '../../lib/dates';
import type { ISODate, Task } from '../../types/models';
import { PRIORITIES } from './labels';

export type TaskTab = 'all' | 'today' | 'week' | 'overdue' | 'completed';
export type TaskSort = 'deadline' | 'priority';

/** Задача ещё не выполнена (Todo или In progress) */
export function isOpenTask(task: Task): boolean {
  return task.status !== 'done';
}

export function filterTasks(tasks: Task[], tab: TaskTab, today: ISODate): Task[] {
  const weekEnd = addDays(today, 7);

  switch (tab) {
    case 'all':
      return tasks.filter(isOpenTask);
    case 'today':
      return tasks.filter((task) => isOpenTask(task) && task.deadline === today);
    case 'week':
      return tasks.filter(
        (task) => isOpenTask(task) && task.deadline !== undefined && task.deadline >= today && task.deadline < weekEnd,
      );
    case 'overdue':
      return tasks.filter((task) => isOpenTask(task) && task.deadline !== undefined && task.deadline < today);
    case 'completed':
      return tasks.filter((task) => task.status === 'done');
  }
}

export function sortTasks(tasks: Task[], sort: TaskSort): Task[] {
  const byDeadline = (a: Task, b: Task) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
  const byPriority = (a: Task, b: Task) => PRIORITIES[a.priority].order - PRIORITIES[b.priority].order;

  return [...tasks].sort((a, b) =>
    sort === 'priority' ? byPriority(a, b) || byDeadline(a, b) : byDeadline(a, b) || byPriority(a, b),
  );
}
