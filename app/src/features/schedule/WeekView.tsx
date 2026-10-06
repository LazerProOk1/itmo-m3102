import { CalendarDays, Plus } from 'lucide-react';
import type { CSSProperties } from 'react';
import { EmptyState } from '../../components/ui/EmptyState';
import { cn } from '../../lib/cn';
import { getDayOfMonth, getShortWeekdayName, timeToMinutes } from '../../lib/dates';
import { useEditMode } from '../settings/EditModeContext';
import type { ISODate } from '../../types/models';
import type { OccurrenceAction } from './OccurrenceMenuItems';
import type { ClassOccurrence, DaySchedule } from './occurrences';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { WeekAgenda } from './WeekAgenda';
import { gridHours, layoutDay } from './weekGrid';
import { WeekOccurrenceCard } from './WeekOccurrenceCard';
import styles from './WeekView.module.css';

interface WeekViewProps {
  days: DaySchedule[];
  today: ISODate;
  time: string;
  onAddDate: (date: ISODate) => void;
  onAction: (action: OccurrenceAction, occurrence: ClassOccurrence) => void;
}

/**
 * Неделя сеткой по часам, как в календаре: высота карточки — длительность пары, видно окна между парами,
 * линия «сейчас» и прошедшие пары. Воскресенье — только если в него есть пары. На узком экране сетка
 * листается вбок по дням, часы слева остаются на месте.
 */
export function WeekView({ days, today, time, onAddDate, onAction }: WeekViewProps) {
  const { isEditMode } = useEditMode();
  const narrow = useMediaQuery('(max-width: 767px)');
  const shown = days.filter((day, index) => index < 6 || day.occurrences.length > 0);
  const { from, to } = gridHours(shown);
  const hours = Array.from({ length: (to - from) / 60 + 1 }, (_, index) => from / 60 + index);
  const now = timeToMinutes(time);

  if (!isEditMode && shown.every((day) => day.occurrences.length === 0)) {
    return <EmptyState icon={CalendarDays} title="На этой неделе пар нет" description="Каникулы или неделя вне семестра." />;
  }

  // Телефон — неделя списком по дням: сетку в 6–7 колонок на узком экране приходилось листать вбок
  if (narrow) return <WeekAgenda days={days} today={today} time={time} onAddDate={onAddDate} onAction={onAction} />;

  return (
    <div className={styles.scroller}>
      <div className={styles.grid} style={{ '--day-count': shown.length, '--span': to - from } as CSSProperties}>
        <div className={styles.corner} />
        {shown.map((day) => (
          <div key={day.date} className={cn(styles.header, day.date === today && styles.headerToday)}>
            <span className={styles.weekday}>{getShortWeekdayName(day.date)}</span>
            <span className={styles.dayNumber}>{getDayOfMonth(day.date)}</span>
            {isEditMode && (
              <button type="button" className={styles.addButton} aria-label="Добавить пару" title="Добавить пару" onClick={() => onAddDate(day.date)}>
                <Plus size={13} strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
        ))}

        <div className={styles.gutter} aria-hidden>
          {hours.map((hour) => (
            <span key={hour} className={styles.hour} style={{ '--at': hour * 60 - from } as CSSProperties}>
              {hour}:00
            </span>
          ))}
        </div>

        {shown.map((day) => {
          const isToday = day.date === today;
          return (
            <div key={day.date} className={cn(styles.column, isToday && styles.columnToday)}>
              {layoutDay(day.occurrences).map(({ occurrence, start, end, lane, lanes }) => (
                <div
                  key={occurrence.key}
                  className={styles.slot}
                  style={{ '--top': start - from, '--len': end - start, '--lane': lane, '--lanes': lanes } as CSSProperties}
                >
                  <WeekOccurrenceCard
                    occurrence={occurrence}
                    today={today}
                    time={time}
                    onAction={onAction}
                    filled
                    past={day.date < today || (isToday && end <= now)}
                  />
                </div>
              ))}
              {isToday && now >= from && now <= to && <div className={styles.now} style={{ '--top': now - from } as CSSProperties} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
