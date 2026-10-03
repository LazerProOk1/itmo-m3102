import { Clock } from 'lucide-react';
import { SECTIONS } from '../../app/navigation';
import { cn } from '../../lib/cn';
import { classTypeColorVar } from '../schedule/labels';
import { useOptionalSubjectName } from '../subjects/subjectsStore';
import type { CalendarEntry } from './calendarEntries';
import styles from './CalendarEntryChip.module.css';

interface CalendarEntryChipProps {
  entry: CalendarEntry;
  onSelect: (entry: CalendarEntry) => void;
  /** В клетке месяца: на телефоне сворачивается в цветную полоску */
  month?: boolean;
}

/**
 * Компактная строка одной записи — для месячного вида и строки «весь день»
 * в недельном/дневном. Дедлайн отличается иконкой часов и цветом, а не карточкой.
 */
export function CalendarEntryChip({ entry, onSelect, month = false }: CalendarEntryChipProps) {
  const subjectName = useOptionalSubjectName(entry.kind === 'class' ? entry.occurrence.details.subjectId : undefined);

  const title =
    entry.kind === 'class'
      ? (subjectName ?? 'Пара')
      : entry.kind === 'deadline'
        ? entry.task.title
        : entry.kind === 'groupDeadline'
          ? entry.deadline.name
          : entry.kind === 'homework'
            ? `ДЗ · ${entry.item.subject}`
            : entry.event.title;
  const isDeadline = entry.kind === 'deadline' || entry.kind === 'groupDeadline';
  const HomeworkIcon = SECTIONS.homework.icon;

  return (
    <button
      type="button"
      className={cn(styles.chip, isDeadline && styles.deadline, entry.kind === 'homework' && styles.homework, month && styles.monthChip)}
      title={entry.kind === 'groupDeadline' ? `${title} — до ${entry.dueTime}` : title}
      onClick={() => onSelect(entry)}
    >
      {isDeadline ? (
        <Clock size={11} strokeWidth={2} className={styles.deadlineIcon} aria-hidden />
      ) : entry.kind === 'homework' ? (
        <HomeworkIcon size={11} strokeWidth={2} className={styles.homeworkIcon} aria-hidden />
      ) : (
        <span
          className={cn(styles.dot, entry.kind === 'event' && styles.eventDot)}
          style={entry.kind === 'class' ? { background: classTypeColorVar(entry.occurrence.details.type) } : undefined}
          aria-hidden
        />
      )}
      {entry.startTime && <span className={styles.time}>{entry.startTime}</span>}
      {entry.kind === 'groupDeadline' && <span className={styles.time}>{entry.dueTime}</span>}
      <span className={styles.title}>{title}</span>
    </button>
  );
}
