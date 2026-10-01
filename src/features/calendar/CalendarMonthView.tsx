import type { Event, ISODate, Task } from '../../types/models';
import { getCalendarEntriesForDate, type CalendarData, type CalendarEntry } from './calendarEntries';
import { MonthCell } from './MonthCell';
import { getMonthGridDates } from './monthGrid';
import styles from './CalendarMonthView.module.css';

const WEEKDAY_HEADERS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

interface CalendarMonthViewProps {
  /** Любая дата внутри показанного месяца */
  anchor: ISODate;
  today: ISODate;
  data: CalendarData;
  onOpenDay: (date: ISODate) => void;
  onEditTask: (task: Task) => void;
  onEditEvent: (event: Event) => void;
  onAddEvent: (date: ISODate) => void;
}

/**
 * Месяц сеткой 6×7. Классы показываются компактной строкой — за полным набором действий
 * (перенос, отмена, замена) нужно открыть день. У задач и событий действие одно — редактирование,
 * поэтому их чипы открывают нужный диалог сразу, без перехода.
 */
export function CalendarMonthView({ anchor, today, data, onOpenDay, onEditTask, onEditEvent, onAddEvent }: CalendarMonthViewProps) {
  const currentMonth = anchor.slice(0, 7);
  const dates = getMonthGridDates(anchor);

  function selectEntry(entry: CalendarEntry) {
    if (entry.kind === 'class') onOpenDay(entry.date);
    else if (entry.kind === 'deadline') onEditTask(entry.task);
    else onEditEvent(entry.event);
  }

  return (
    <div>
      <div className={styles.weekdayRow}>
        {WEEKDAY_HEADERS.map((label) => (
          <div key={label} className={styles.weekdayHeader}>
            {label}
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        {dates.map((date) => (
          <MonthCell
            key={date}
            date={date}
            isCurrentMonth={date.slice(0, 7) === currentMonth}
            isToday={date === today}
            entries={getCalendarEntriesForDate(date, data)}
            onOpenDay={onOpenDay}
            onSelectEntry={selectEntry}
            onAddEvent={onAddEvent}
          />
        ))}
      </div>
    </div>
  );
}
