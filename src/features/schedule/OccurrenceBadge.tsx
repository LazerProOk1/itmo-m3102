import { Badge } from '../../components/ui/Badge';
import { OCCURRENCE_BADGES } from './labels';
import type { ClassOccurrence } from './occurrences';

interface OccurrenceBadgeProps {
  occurrence: ClassOccurrence;
  isNow?: boolean;
}

/** Метка «Сейчас» или вид исключения. У обычного занятия ничего не показывает. */
export function OccurrenceBadge({ occurrence, isNow = false }: OccurrenceBadgeProps) {
  if (isNow) return <Badge tone="accent">Сейчас</Badge>;

  const badge = OCCURRENCE_BADGES[occurrence.status];
  return badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null;
}
