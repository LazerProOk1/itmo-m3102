import { AnimatePresence } from 'framer-motion';
import { useRef, useState, type CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import type { Event } from '../../types/models';
import { ClassDetailsPopover } from '../schedule/ClassDetailsPopover';
import { classTypeColorVar, OCCURRENCE_BADGES } from '../schedule/labels';
import { OccurrenceMenuButton } from '../schedule/OccurrenceMenuButton';
import type { OccurrenceAction } from '../schedule/OccurrenceMenuItems';
import { takesPlace, type ClassOccurrence } from '../schedule/occurrences';
import { useSubjectName } from '../subjects/subjectsStore';
import type { TimedCalendarEntry } from './calendarEntries';
import styles from './CalendarBlock.module.css';

interface CalendarBlockProps {
  /** Запись с временем — class или event (у deadline времени не бывает, для сетки не используется) */
  entry: TimedCalendarEntry;
  style: CSSProperties;
  onClassAction: (action: OccurrenceAction, occurrence: ClassOccurrence) => void;
  onEditEvent: (event: Event) => void;
}

/** Занятие или событие, позиционированное на сетке времени недельного/дневного вида. */
export function CalendarBlock({ entry, style, onClassAction, onEditEvent }: CalendarBlockProps) {
  if (entry.kind === 'class') {
    return <ClassBlock entry={entry} style={style} onAction={onClassAction} />;
  }

  return (
    <button type="button" className={cn(styles.block, styles.event)} style={style} onClick={() => onEditEvent(entry.event)}>
      <span className={styles.time}>{entry.startTime}</span>
      <p className={styles.title}>{entry.event.title}</p>
    </button>
  );
}

interface ClassBlockProps {
  entry: Extract<TimedCalendarEntry, { kind: 'class' }>;
  style: CSSProperties;
  onAction: CalendarBlockProps['onClassAction'];
}

function ClassBlock({ entry, style, onAction }: ClassBlockProps) {
  const { occurrence } = entry;
  const subjectName = useSubjectName(occurrence.details.subjectId);
  const isCancelled = !takesPlace(occurrence);
  const badge = OCCURRENCE_BADGES[occurrence.status];
  const [popoverOpen, setPopoverOpen] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);

  function handleEdit() {
    setPopoverOpen(false);
    onAction(occurrence.exception && occurrence.status !== 'cancelled' ? 'editException' : 'editClass', occurrence);
  }

  return (
    <div
      ref={blockRef}
      className={cn(styles.block, isCancelled && styles.cancelled)}
      style={{ ...style, '--type-color': classTypeColorVar(occurrence.details.type) } as CSSProperties}
      onClick={() => setPopoverOpen(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => event.key === 'Enter' && setPopoverOpen(true)}
    >
      <div className={styles.header} onClick={(event) => event.stopPropagation()}>
        <span className={styles.time}>{entry.startTime}</span>
        <OccurrenceMenuButton occurrence={occurrence} onAction={onAction} />
      </div>
      <p className={styles.title}>{subjectName}</p>
      {occurrence.details.room && <p className={styles.meta}>Аудитория {occurrence.details.room}</p>}
      {badge && <span className={styles.badge}>{badge.label}</span>}

      <AnimatePresence>
        {popoverOpen && (
          <ClassDetailsPopover occurrence={occurrence} anchorRef={blockRef} onClose={() => setPopoverOpen(false)} onEdit={handleEdit} />
        )}
      </AnimatePresence>
    </div>
  );
}
