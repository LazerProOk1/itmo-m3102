import type { ID, ISODate, Task } from '../../types/models';
import { sortTasks } from '../tasks/taskFilters';

/** Незавершённые задачи предмета */
export function getOpenTasks(tasks: Task[], subjectId: ID): Task[] {
  return tasks.filter((task) => task.subjectId === subjectId && task.status !== 'done');
}

/** Ближайший срок среди незавершённых задач предмета, если он есть */
export function getNextDeadline(tasks: Task[], subjectId: ID, today: ISODate): ISODate | undefined {
  const openTasks = getOpenTasks(tasks, subjectId).filter((task) => task.deadline !== undefined && task.deadline >= today);
  return sortTasks(openTasks, 'deadline')[0]?.deadline;
}
