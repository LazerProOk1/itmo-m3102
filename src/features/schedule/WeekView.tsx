import { Plus } from 'lucide-react';
import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { getDayOfMonth, getShortWeekdayName } from '../../lib/dates';
import { useEditMode } from '../settings/EditModeContext';
import type { ISODate } from '../../types/models';
import type { OccurrenceAction } from './OccurrenceMenuItems';
import type { ClassOccurrence, DaySchedule } from './occurrences';
import { WeekOccurrenceCard } from './WeekOccurrenceCard';
import styles from './WeekView.module.css';

interface WeekViewProps {
  days: DaySchedule[];
  today: ISODate;
  time: string;
  onAddDate: (date: ISODate) => void;
  onAction: (action: OccurrenceAction, occurrence: ClassOccurrence) => void;
}

/** Неделя колонками: Mon–Sat (+Sun, если в нём есть занятия). */
export function WeekView({ days, today, time, onAddDate, onAction }: WeekViewProps) {
  const { isEditMode } = useEditMode();

  return (
    // Число колонок передаём переменной CSS, а не через gridTemplateColumns напрямую:
    // так колонки не сжимаются меньше своего min-width из WeekView.module.css на узких экранах,
    // и вместо наложения текста появляется горизонтальная прокрутка.
    <div className={styles.grid} style={{ '--day-count': days.length } as CSSProperties}>
      {days.map((day) => {
        const isToday = day.date === today;

        return (
          <div key={day.date} className={styles.column}>
            <div className={cn(styles.header, isToday && styles.headerToday)}>
              <span className={styles.weekday}>{getShortWeekdayName(day.date)}</span>
              <span className={styles.dayNumber}>{getDayOfMonth(day.date)}</span>
            </div>

            <div className={styles.body}>
              {day.occurrences.map((occurrence) => (
                <WeekOccurrenceCard
                  key={occurrence.key}
                  occurrence={occurrence}
                  today={today}
                  time={time}
                  onAction={onAction}
                />
              ))}

              {isEditMode && (
                <button type="button" className={styles.addButton} onClick={() => onAddDate(day.date)}>
                  <Plus size={12} strokeWidth={2} aria-hidden />
                  Добавить
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
