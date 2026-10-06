import { Circle, CircleCheck, CircleDot, type LucideIcon } from 'lucide-react';
import type { BadgeTone } from '../../components/ui/Badge';
import type { TaskPriority, TaskStatus, TaskType } from '../../types/models';

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  homework: 'Домашнее задание',
  lab: 'Лабораторная',
  project: 'Проект',
  preparation: 'Подготовка',
  exam: 'Экзамен',
  other: 'Другое',
};

/** order — для сортировки: чем меньше, тем важнее */
export const PRIORITIES: Record<TaskPriority, { label: string; tone: BadgeTone; order: number }> = {
  critical: { label: 'Критичный', tone: 'danger', order: 0 },
  high: { label: 'Высокий', tone: 'warning', order: 1 },
  normal: { label: 'Обычный', tone: 'neutral', order: 2 },
  low: { label: 'Низкий', tone: 'neutral', order: 3 },
};

export const STATUSES: Record<TaskStatus, { label: string; icon: LucideIcon }> = {
  todo: { label: 'Не начато', icon: Circle },
  in_progress: { label: 'В процессе', icon: CircleDot },
  done: { label: 'Готово', icon: CircleCheck },
};

/** "Programming · Lab" — subjectName приходит от вызывающего кода (реактивно или из статического списка) */
export function formatTaskMeta(subjectName: string | undefined, type: TaskType): string {
  return [subjectName, TASK_TYPE_LABELS[type]].filter(Boolean).join(' · ');
}
