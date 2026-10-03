import { Plus } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { cn } from '../../lib/cn';
import { getDayOfMonth, getShortWeekdayName, minutesBetween } from '../../lib/dates';
import { useEditMode } from '../settings/EditModeContext';
import type { Event, ISODate, Task } from '../../types/models';
import type { OccurrenceAction } from '../schedule/OccurrenceMenuItems';
import type { ClassOccurrence } from '../schedule/occurrences';
import { getCalendarEntriesForDate, isAllDay, isTimedEntry, type CalendarData, type CalendarEntry, type TimedCalendarEntry } from './calendarEntries';
import { CalendarBlock } from './CalendarBlock';
import { CalendarEntryChip } from './CalendarEntryChip';
import styles from './TimeGrid.module.css';

/** Видимый диапазон часов. Пар классов в mock-данных укладывается в него с запасом. */
const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_HEIGHT = 48;
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index);
/** Событие без указанного конца показывается этой длительностью */
const DEFAULT_EVENT_MINUTES = 30;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function timeToOffset(time: string): number {
  return (minutesBetween(`${START_HOUR}:00`, time) / 60) * HOUR_HEIGHT;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [hours = 0, mins = 0] = time.split(':').map(Number);
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function getBlockStyle(entry: TimedCalendarEntry): CSSProperties {
  const endTime = entry.kind === 'class' ? entry.endTime : (entry.endTime ?? addMinutesToTime(entry.startTime, DEFAULT_EVENT_MINUTES));
  const top = clamp(timeToOffset(entry.startTime), 0, TOTAL_HEIGHT);
  const bottom = clamp(timeToOffset(endTime), 0, TOTAL_HEIGHT);
  return { top, height: Math.max(22, bottom - top) };
}

interface TimeGridProps {
  /** Один день — Day view, семь — Week view */
  days: ISODate[];
  today: ISODate;
  /** Текущее время "HH:mm" — для линии «сейчас» на сегодняшнем дне */
  time: string;
  data: CalendarData;
  onClassAction: (action: OccurrenceAction, occurrence: ClassOccurrence) => void;
  onEditTask: (task: Task) => void;
  onEditEvent: (event: Event) => void;
  onAddEvent: (date: ISODate) => void;
}

/**
 * Сетка времени: часы слева, дни колонками, занятия и события — блоки по времени,
 * дедлайны и события без времени — строкой «весь день» сверху. Используется и для
 * недельного, и для дневного вида Calendar — просто с разным числом дней.
 */
export function TimeGrid({ days, today, time, data, onClassAction, onEditTask, onEditEvent, onAddEvent }: TimeGridProps) {
  const { isEditMode } = useEditMode();
  const navigate = useNavigate();
  const columns = days.map((date) => ({ date, entries: getCalendarEntriesForDate(date, data) }));
  const nowOffset = timeToOffset(time);
  const showNowLine = nowOffset >= 0 && nowOffset <= TOTAL_HEIGHT;

  function selectEntry(entry: CalendarEntry) {
    if (entry.kind === 'deadline') onEditTask(entry.task);
    if (entry.kind === 'event') onEditEvent(entry.event);
    if (entry.kind === 'groupDeadline') navigate(SECTIONS.deadlines.path);
    if (entry.kind === 'homework') navigate(SECTIONS.homework.path);
    // У class-записей в строке «весь день» взяться неоткуда — у занятий всегда есть время
  }

  return (
    <div className={styles.grid} style={{ '--day-count': days.length } as CSSProperties}>
      <div className={styles.corner} />
      {columns.map(({ date }) => (
        <div key={date} className={cn(styles.dayHeader, date === today && styles.dayHeaderToday)}>
          <span className={styles.weekday}>{getShortWeekdayName(date)}</span>
          <span className={styles.dayNumber}>{getDayOfMonth(date)}</span>
        </div>
      ))}

      <div className={styles.allDayLabel}>Весь день</div>
      {columns.map(({ date, entries }) => (
        <div key={date} className={styles.allDayCell}>
          {entries.filter(isAllDay).map((entry) => (
            <CalendarEntryChip key={entry.key} entry={entry} onSelect={selectEntry} />
          ))}
          {isEditMode && (
            <button type="button" className={styles.addButton} onClick={() => onAddEvent(date)}>
              <Plus size={11} strokeWidth={2} aria-hidden />
              Добавить
            </button>
          )}
        </div>
      ))}

      <div className={styles.hours} style={{ height: TOTAL_HEIGHT }}>
        {HOURS.map((hour) => (
          <span key={hour} className={styles.hourLabel} style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}>
            {String(hour).padStart(2, '0')}:00
          </span>
        ))}
      </div>

      {columns.map(({ date, entries }) => (
        <div key={date} className={styles.dayColumn} style={{ height: TOTAL_HEIGHT }}>
          {entries.filter(isTimedEntry).map((entry) => (
            <CalendarBlock key={entry.key} entry={entry} style={getBlockStyle(entry)} onClassAction={onClassAction} onEditEvent={onEditEvent} />
          ))}
          {date === today && showNowLine && <div className={styles.nowLine} style={{ top: nowOffset }} />}
        </div>
      ))}
    </div>
  );
}
