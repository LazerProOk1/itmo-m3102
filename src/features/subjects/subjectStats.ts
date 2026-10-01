import { resolveSubjectFolder } from '../../data/m3102';
import type { ID, ISODate, Task } from '../../types/models';
import type { GroupDeadline } from '../group/groupStore';

/** Незавершённые задачи предмета */
export function getOpenTasks(tasks: Task[], subjectId: ID): Task[] {
  return tasks.filter((task) => task.subjectId === subjectId && task.status !== 'done');
}

/** Предмет дедлайна группы — по префиксу названия: «ДМ - Карточки», «ИСРПО — Документация» */
export function deadlineSubjectId(name: string): ID | undefined {
  return resolveSubjectFolder(name.split(/\s+[-–—]\s+/)[0]!);
}

/**
 * Ближайший срок предмета: незавершённые задачи учебного плана и дедлайны группы,
 * не отмеченные «выполнено для меня».
 */
export function getNextDeadline(
  tasks: Task[],
  subjectId: ID,
  today: ISODate,
  group: { deadlines: GroupDeadline[]; done: Record<string, boolean> } = { deadlines: [], done: {} },
): ISODate | undefined {
  const fromTasks = getOpenTasks(tasks, subjectId)
    .filter((task) => task.deadline !== undefined && task.deadline >= today)
    .map((task) => task.deadline!);
  // Дата из "2026-10-02T23:59:00+03:00" — по московскому времени, как в файле
  const fromGroup = group.deadlines
    .filter((item) => !group.done[item.id] && deadlineSubjectId(item.name) === subjectId)
    .map((item) => item.deadline.slice(0, 10))
    .filter((date) => date >= today);
  return [...fromTasks, ...fromGroup].sort()[0];
}
