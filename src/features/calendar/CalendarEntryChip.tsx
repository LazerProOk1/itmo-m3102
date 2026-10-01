import { Clock } from 'lucide-react';
import { cn } from '../../lib/cn';
import { classTypeColorVar } from '../schedule/labels';
import { useOptionalSubjectName } from '../subjects/subjectsStore';
import type { CalendarEntry } from './calendarEntries';
import styles from './CalendarEntryChip.module.css';

interface CalendarEntryChipProps {
  entry: CalendarEntry;
  onSelect: (entry: CalendarEntry) => void;
}

/**
 * Компактная строка одной записи — для месячного вида и строки «весь день»
 * в недельном/дневном. Дедлайн отличается иконкой часов и цветом, а не карточкой.
 */
export function CalendarEntryChip({ entry, onSelect }: CalendarEntryChipProps) {
  const subjectName = useOptionalSubjectName(entry.kind === 'class' ? entry.occurrence.details.subjectId : undefined);

  const title = entry.kind === 'class' ? (subjectName ?? 'Пара') : entry.kind === 'deadline' ? entry.task.title : entry.event.title;

  return (
    <button
      type="button"
      className={cn(styles.chip, entry.kind === 'deadline' && styles.deadline)}
      onClick={() => onSelect(entry)}
    >
      {entry.kind === 'deadline' ? (
        <Clock size={11} strokeWidth={2} className={styles.deadlineIcon} aria-hidden />
      ) : (
        <span
          className={cn(styles.dot, entry.kind === 'event' && styles.eventDot)}
          style={entry.kind === 'class' ? { background: classTypeColorVar(entry.occurrence.details.type) } : undefined}
          aria-hidden
        />
      )}
      {entry.startTime && <span className={styles.time}>{entry.startTime}</span>}
      <span className={styles.title}>{title}</span>
    </button>
  );
}
