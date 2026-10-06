import { MapPin } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useState, type CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { SPRING_SNAPPY } from '../../lib/motion';
import { useCursorGlow } from '../../lib/useCursorGlow';
import { useSubjectName } from '../subjects/subjectsStore';
import { ClassDetailsPopover } from './ClassDetailsPopover';
import { classTypeColorVar, CLASS_TYPE_LABELS, CLASS_TYPE_SHORT, describeMove } from './labels';
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
  /** В сетке по часам: заполняет свой отрезок времени непрозрачной цветной плашкой */
  filled?: boolean;
  /** Пара уже прошла — содержимое тише */
  past?: boolean;
}

/**
 * Компактная карточка занятия в колонке недельного вида. Клик открывает popover с деталями занятия.
 * Нажимается невидимая кнопка на всю карточку, а меню «⋯» лежит поверх неё: кнопка внутри role="button"
 * — две вложенные интерактивные области, и Пробел у div-кнопки не работал.
 */
export function WeekOccurrenceCard({ occurrence, today, time, onAction, filled = false, past = false }: WeekOccurrenceCardProps) {
  const subjectName = useSubjectName(occurrence.details.subjectId);
  const isNow = isHappeningNow(occurrence, today, time);
  const isCancelled = !takesPlace(occurrence);
  const moveNote = describeMove(occurrence);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const glow = useCursorGlow();

  function handleEdit() {
    setPopoverOpen(false);
    onAction(occurrence.exception && occurrence.status !== 'cancelled' ? 'editException' : 'editClass', occurrence);
  }

  const interactive = !isNow && !isCancelled;

  return (
    <motion.div
      ref={cardRef}
      data-lit=""
      onPointerMove={glow.onPointerMove}
      onPointerLeave={glow.onPointerLeave}
      className={cn(styles.card, filled && styles.filled, past && styles.past, isNow && styles.now, isCancelled && styles.cancelled)}
      style={{ '--type-color': classTypeColorVar(occurrence.details.type) } as CSSProperties}
      whileHover={interactive ? { y: -2 } : undefined}
      whileTap={interactive ? { y: 0, scale: 0.985 } : undefined}
      transition={SPRING_SNAPPY}
    >
      <button
        type="button"
        className={styles.open}
        aria-label={`${subjectName}, ${CLASS_TYPE_LABELS[occurrence.details.type]}, ${occurrence.details.startTime}–${occurrence.details.endTime}`}
        onClick={() => setPopoverOpen(true)}
      />
      <div className={styles.top}>
        <span className={styles.time}>
          {occurrence.details.startTime}–{occurrence.details.endTime}
        </span>
        <span className={styles.menu}>
          <OccurrenceMenuButton occurrence={occurrence} onAction={onAction} />
        </span>
      </div>

      <p className={styles.subject}>{subjectName}</p>
      <p className={styles.meta}>
        {/* Тип — словом: цвет типа уже несёт полоска слева, цветная плашка была третьим сигналом */}
        <span title={CLASS_TYPE_LABELS[occurrence.details.type]}>{CLASS_TYPE_SHORT[occurrence.details.type]}</span>
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
        {popoverOpen && <ClassDetailsPopover occurrence={occurrence} anchorRef={cardRef} onClose={() => setPopoverOpen(false)} onEdit={handleEdit} />}
      </AnimatePresence>
    </motion.div>
  );
}
