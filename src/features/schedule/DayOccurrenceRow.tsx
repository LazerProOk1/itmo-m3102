import { AnimatePresence } from 'framer-motion';
import { useRef, useState, type CSSProperties } from 'react';
import { ListItem } from '../../components/ui/List';
import { cn } from '../../lib/cn';
import { useSubjectName } from '../subjects/subjectsStore';
import { ClassDetailsPopover } from './ClassDetailsPopover';
import { classTypeColorVar, CLASS_TYPE_LABELS, describeMove } from './labels';
import { OccurrenceBadge } from './OccurrenceBadge';
import { OccurrenceMenuButton } from './OccurrenceMenuButton';
import type { OccurrenceAction } from './OccurrenceMenuItems';
import { isHappeningNow, takesPlace, type ClassOccurrence } from './occurrences';
import styles from './DayOccurrenceRow.module.css';

interface DayOccurrenceRowProps {
  occurrence: ClassOccurrence;
  today: string;
  time: string;
  onAction: (action: OccurrenceAction, occurrence: ClassOccurrence) => void;
}

/** Строка занятия в дневном виде: время, предмет, тип, аудитория, преподаватель. Клик по названию открывает popover с деталями. */
export function DayOccurrenceRow({ occurrence, today, time, onAction }: DayOccurrenceRowProps) {
  const subjectName = useSubjectName(occurrence.details.subjectId);
  const isNow = isHappeningNow(occurrence, today, time);
  const isCancelled = !takesPlace(occurrence);
  const moveNote = describeMove(occurrence);
  const { details } = occurrence;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const titleRef = useRef<HTMLButtonElement>(null);

  const metaParts = [CLASS_TYPE_LABELS[details.type], details.room && `Аудитория ${details.room}`, details.teacher].filter(
    Boolean,
  );

  function handleEdit() {
    setPopoverOpen(false);
    onAction(occurrence.exception && occurrence.status !== 'cancelled' ? 'editException' : 'editClass', occurrence);
  }

  return (
    <ListItem
      className={styles.row}
      highlighted={isNow}
      muted={isCancelled}
      style={{ '--type-color': classTypeColorVar(details.type) } as CSSProperties}
      leading={
        <span className={cn(styles.time, isNow && styles.timeNow)}>
          {details.startTime}
          <span className={styles.endTime}>{details.endTime}</span>
        </span>
      }
      title={
        <>
          <button ref={titleRef} type="button" className={styles.titleButton} onClick={() => setPopoverOpen(true)}>
            <span className={cn(isCancelled && styles.cancelledTitle)}>{subjectName}</span>
          </button>
          <AnimatePresence>
            {popoverOpen && (
              <ClassDetailsPopover
                occurrence={occurrence}
                anchorRef={titleRef}
                onClose={() => setPopoverOpen(false)}
                onEdit={handleEdit}
              />
            )}
          </AnimatePresence>
        </>
      }
      meta={moveNote ? `${metaParts.join(' · ')} · ${moveNote}` : metaParts.join(' · ')}
      trailing={
        <>
          <OccurrenceBadge occurrence={occurrence} isNow={isNow} />
          <OccurrenceMenuButton occurrence={occurrence} onAction={onAction} />
        </>
      }
    />
  );
}
