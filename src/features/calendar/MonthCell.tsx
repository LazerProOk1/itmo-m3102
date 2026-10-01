import { Plus } from 'lucide-react';
import { cn } from '../../lib/cn';
import { getDayOfMonth } from '../../lib/dates';
import { useEditMode } from '../settings/EditModeContext';
import type { ISODate } from '../../types/models';
import type { CalendarEntry } from './calendarEntries';
import { CalendarEntryChip } from './CalendarEntryChip';
import styles from './MonthCell.module.css';

const MAX_VISIBLE = 3;

interface MonthCellProps {
  date: ISODate;
  isCurrentMonth: boolean;
  isToday: boolean;
  entries: CalendarEntry[];
  onOpenDay: (date: ISODate) => void;
  onSelectEntry: (entry: CalendarEntry) => void;
  onAddEvent: (date: ISODate) => void;
}

/**
 * Один день месячной сетки: номер дня, до трёх компактных записей и «+N more».
 * И номер дня, и «+N more» открывают дневной вид — там записей помещается сколько угодно.
 */
export function MonthCell({ date, isCurrentMonth, isToday, entries, onOpenDay, onSelectEntry, onAddEvent }: MonthCellProps) {
  const { isEditMode } = useEditMode();
  const visible = entries.slice(0, MAX_VISIBLE);
  const hiddenCount = entries.length - visible.length;

  return (
    <div className={cn(styles.cell, !isCurrentMonth && styles.outside)}>
      <div className={styles.header}>
        <button type="button" className={cn(styles.dayNumber, isToday && styles.today)} onClick={() => onOpenDay(date)}>
          {getDayOfMonth(date)}
        </button>
        {isEditMode && (
          <button
            type="button"
            className={styles.addButton}
            aria-label="Добавить событие"
            onClick={() => onAddEvent(date)}
          >
            <Plus size={11} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      <div className={styles.entries}>
        {visible.map((entry) => (
          <CalendarEntryChip key={entry.key} entry={entry} onSelect={onSelectEntry} />
        ))}
        {hiddenCount > 0 && (
          <button type="button" className={styles.more} onClick={() => onOpenDay(date)}>
            ещё {hiddenCount}
          </button>
        )}
      </div>
    </div>
  );
}
