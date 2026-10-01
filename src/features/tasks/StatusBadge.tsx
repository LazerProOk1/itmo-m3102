import { Badge } from '../../components/ui/Badge';
import type { TaskStatus } from '../../types/models';

interface StatusBadgeProps {
  status: TaskStatus;
}

/** Показывается только для «In progress» — Todo и Done и так видны по чекбоксу и зачёркиванию. */
export function StatusBadge({ status }: StatusBadgeProps) {
  if (status !== 'in_progress') return null;
  return <Badge tone="accent">В процессе</Badge>;
}
