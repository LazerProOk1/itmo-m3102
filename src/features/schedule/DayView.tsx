import { CalendarDays } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { List } from '../../components/ui/List';
import { cn } from '../../lib/cn';
import { onRovingKeyDown } from '../../lib/rovingKeys';
import { formatDuration, getDayOfMonth, getShortWeekdayName, minutesBetween } from '../../lib/dates';
import { Fragment } from 'react';
import type { ISODate } from '../../types/models';
import { DayOccurrenceRow } from './DayOccurrenceRow';
import type { OccurrenceAction } from './OccurrenceMenuItems';
import { takesPlace, type ClassOccurrence, type DaySchedule } from './occurrences';
import styles from './DayView.module.css';

interface DayViewProps {
  days: DaySchedule[];
  selectedDate: ISODate;
  today: ISODate;
  time: string;
  onSelectDate: (date: ISODate) => void;
  onAction: (action: OccurrenceAction, occurrence: ClassOccurrence) => void;
}

/** Один день: полоса дней недели для переключения + список занятий выбранного дня. */
export function DayView({ days, selectedDate, today, time, onSelectDate, onAction }: DayViewProps) {
  const selected = days.find((day) => day.date === selectedDate) ?? days[0];

  return (
    <div>
      <div
        className={styles.strip}
        role="tablist"
        aria-label="День недели"
        onKeyDown={(event) =>
          onRovingKeyDown(
            event,
            days.map((day) => day.date),
            selected?.date ?? days[0]!.date,
            onSelectDate,
          )
        }
      >
        {days.map((day) => {
          const isSelected = day.date === selected?.date;
          const isToday = day.date === today;

          return (
            <button
              key={day.date}
              type="button"
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              className={cn(styles.day, isSelected && styles.daySelected)}
              onClick={() => onSelectDate(day.date)}
            >
              <span className={styles.weekday}>{getShortWeekdayName(day.date)}</span>
              <span className={cn(styles.dayNumber, isToday && styles.dayNumberToday)}>{getDayOfMonth(day.date)}</span>
              {/* Точек столько, сколько пар (до шести) — видно, насколько загружен день */}
              <span className={styles.dots} aria-label={`${day.occurrences.length} пар`}>
                {day.occurrences.slice(0, 6).map((occurrence) => (
                  <span key={occurrence.key} className={styles.dot} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {!selected || selected.occurrences.length === 0 ? (
        <EmptyState compact icon={CalendarDays} title="В этот день пар нет" />
      ) : (
        <List>
          {selected.occurrences.map((occurrence, index) => (
            <Fragment key={occurrence.key}>
              <BreakRow previous={selected.occurrences[index - 1]} next={occurrence} />
              <DayOccurrenceRow occurrence={occurrence} today={today} time={time} onAction={onAction} />
            </Fragment>
          ))}
        </List>
      )}
    </div>
  );
}

/** Между парами — «Перемена 10 мин» или «Окно 1 ч 30 мин»: сразу видно, где свободное время */
function BreakRow({ previous, next }: { previous?: ClassOccurrence; next: ClassOccurrence }) {
  if (!previous || !takesPlace(previous) || !takesPlace(next)) return null;
  const minutes = minutesBetween(previous.details.endTime, next.details.startTime);
  if (minutes <= 0) return null;
  return (
    <li className={cn(styles.break, minutes > 20 && styles.window)} aria-label={`Перерыв ${formatDuration(minutes)}`}>
      <span>{minutes > 20 ? `Окно ${formatDuration(minutes)}` : `Перемена ${minutes} мин`}</span>
    </li>
  );
}
