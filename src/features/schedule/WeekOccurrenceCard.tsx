import { MapPin } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useState, type CSSProperties } from 'react';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/cn';
import { SPRING_SNAPPY } from '../../lib/motion';
import { useSubjectName } from '../subjects/subjectsStore';
import { ClassDetailsPopover } from './ClassDetailsPopover';
import { classTypeColorVar, CLASS_TYPE_LABELS, CLASS_TYPE_TONES, describeMove } from './labels';
import { OccurrenceBadge } from './OccurrenceBadge';
import { OccurrenceMenuButton } from './OccurrenceMenuButton';
import { isHappeningNow, takesPlace, type ClassOccurrence } from './occurrences';
import type { OccurrenceAction } from './OccurrenceMenuItems';
import styles from './WeekOccurrenceCard.module.css';

interface WeekOccurrenceCardProps {
  occurrence: ClassOccurrence;
  today: string;
  time: string;
  onAction: (action: OccurrenceAction, occurrence: ClassOccurrence) => void;
}

/** Компактная карточка занятия в колонке недельного вида. Клик открывает popover с деталями занятия. */
export function WeekOccurrenceCard({ occurrence, today, time, onAction }: WeekOccurrenceCardProps) {
  const subjectName = useSubjectName(occurrence.details.subjectId);
  const isNow = isHappeningNow(occurrence, today, time);
  const isCancelled = !takesPlace(occurrence);
  const moveNote = describeMove(occurrence);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  function handleEdit() {
    setPopoverOpen(false);
    onAction(occurrence.exception && occurrence.status !== 'cancelled' ? 'editException' : 'editClass', occurrence);
  }

  const interactive = !isNow && !isCancelled;

  return (
    <motion.div
      ref={cardRef}
      className={cn(styles.card, isNow && styles.now, isCancelled && styles.cancelled)}
      style={{ '--type-color': classTypeColorVar(occurrence.details.type) } as CSSProperties}
      onClick={() => setPopoverOpen(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => event.key === 'Enter' && setPopoverOpen(true)}
      whileHover={interactive ? { y: -2 } : undefined}
      whileTap={interactive ? { y: 0, scale: 0.985 } : undefined}
      transition={SPRING_SNAPPY}
    >
      <div className={styles.top} onClick={(event) => event.stopPropagation()}>
        <span className={styles.time}>
          {occurrence.details.startTime} – {occurrence.details.endTime}
        </span>
        <OccurrenceMenuButton occurrence={occurrence} onAction={onAction} />
      </div>

      <p className={styles.subject}>{subjectName}</p>
      <p className={styles.meta}>
        <Badge tone={CLASS_TYPE_TONES[occurrence.details.type]}>{CLASS_TYPE_LABELS[occurrence.details.type]}</Badge>
        {occurrence.details.room && (
          <span className={styles.room}>
            <MapPin size={11} strokeWidth={1.75} aria-hidden />
            {occurrence.details.room}
          </span>
        )}
      </p>

      <div className={styles.badges}>
        <OccurrenceBadge occurrence={occurrence} isNow={isNow} />
      </div>

      {moveNote && <p className={styles.note}>{moveNote}</p>}

      <AnimatePresence>
        {popoverOpen && (
          <ClassDetailsPopover
            occurrence={occurrence}
            anchorRef={cardRef}
            onClose={() => setPopoverOpen(false)}
            onEdit={handleEdit}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
