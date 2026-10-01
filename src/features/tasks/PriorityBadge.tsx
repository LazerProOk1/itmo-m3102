import { Badge } from '../../components/ui/Badge';
import type { TaskPriority } from '../../types/models';
import { PRIORITIES } from './labels';

interface PriorityBadgeProps {
  priority: TaskPriority;
}

/** Метка приоритета. Обычный приоритет не подписываем — меньше визуального шума. */
export function PriorityBadge({ priority }: PriorityBadgeProps) {
  if (priority === 'normal') return null;

  const { label, tone } = PRIORITIES[priority];
  return <Badge tone={tone}>{label}</Badge>;
}
