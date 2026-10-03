import { Plus } from 'lucide-react';
import { Fragment } from 'react';
import { List } from '../../components/ui/List';
import { cn } from '../../lib/cn';
import { formatShortDate, getWeekdayName } from '../../lib/dates';
import { pluralize } from '../../lib/pluralize';
import type { ISODate } from '../../types/models';
import { useEditMode } from '../settings/EditModeContext';
import { BreakRow } from './DayView';
import { DayOccurrenceRow } from './DayOccurrenceRow';
import type { OccurrenceAction } from './OccurrenceMenuItems';
import { takesPlace, type ClassOccurrence, type DaySchedule } from './occurrences';
import styles from './WeekAgenda.module.css';

interface WeekAgendaProps {
  days: DaySchedule[];
  today: ISODate;
  time: string;
  onAddDate: (date: ISODate) => void;
  onAction: (action: OccurrenceAction, occurrence: ClassOccurrence) => void;
}

/**
 * Неделя на телефоне — списком по дням сверху вниз (как «Расписание» в Google Календаре): сетка в 7 колонок
 * на узком экране листается вбок и не читается. Строки пар — те же, что в режиме «День».
 */
export function WeekAgenda({ days, today, time, onAddDate, onAction }: WeekAgendaProps) {
  const { isEditMode } = useEditMode();
  // Воскресенье — только если в него есть пары
  const shown = days.filter((day, index) => index < 6 || day.occurrences.length > 0);

  return (
    <div className={styles.agenda}>
      {shown.map((day) => {
        const isToday = day.date === today;
        const count = day.occurrences.filter(takesPlace).length;
        return (
          <section key={day.date} className={cn(styles.day, day.date < today && styles.past)} aria-label={getWeekdayName(day.date)}>
            <header className={cn(styles.header, isToday && styles.today)}>
              <span className={styles.weekday}>{getWeekdayName(day.date)}</span>
              <span className={styles.date}>{formatShortDate(day.date, 'long')}</span>
              {isToday && <span className={styles.todayBadge}>Сегодня</span>}
              <span className={styles.count}>{count ? pluralize(count, ['пара', 'пары', 'пар']) : 'Пар нет'}</span>
              {isEditMode && (
                <button type="button" className={styles.add} aria-label="Добавить пару" onClick={() => onAddDate(day.date)}>
                  <Plus size={14} strokeWidth={2} aria-hidden />
                </button>
              )}
            </header>
            {day.occurrences.length > 0 && (
              <List>
                {day.occurrences.map((occurrence, index) => (
                  <Fragment key={occurrence.key}>
                    <BreakRow previous={day.occurrences[index - 1]} next={occurrence} />
                    <DayOccurrenceRow occurrence={occurrence} today={today} time={time} onAction={onAction} />
                  </Fragment>
                ))}
              </List>
            )}
          </section>
        );
      })}
    </div>
  );
}
