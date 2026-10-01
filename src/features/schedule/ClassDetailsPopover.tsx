import { Clock, MapPin, Pencil, Plus, User, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SPRING_SNAPPY } from '../../lib/motion';
import { useFloatingPosition } from '../../lib/useFloatingPosition';
import { HomeworkCard } from '../homework/HomeworkCard';
import { useHomeworkDialog } from '../homework/HomeworkDialog';
import { useHomeworkStore } from '../homework/homeworkStore';
import { useEditMode } from '../settings/EditModeContext';
import { useSubjectName } from '../subjects/subjectsStore';
import { CLASS_TYPE_LABELS, CLASS_TYPE_TONES } from './labels';
import type { ClassOccurrence } from './occurrences';
import styles from './ClassDetailsPopover.module.css';

interface ClassDetailsPopoverProps {
  occurrence: ClassOccurrence;
  onClose: () => void;
  onEdit: () => void;
  /** Карточка/строка, к которой привязан popover — задаёт точку появления и позицию */
  anchorRef: RefObject<HTMLElement | null>;
  /** По какому краю карточки выравнивать popover, пока хватает места на экране */
  align?: 'start' | 'end';
}

/**
 * Компактная карточка деталей занятия — открывается кликом по занятию вместо диалога
 * редактирования. Рисуется через портал в document.body (см. useFloatingPosition) —
 * так её не может запереть в себе stacking context карточки-триггера (та ловит hover-lift).
 */
export function ClassDetailsPopover({ occurrence, onClose, onEdit, anchorRef, align = 'start' }: ClassDetailsPopoverProps) {
  const { isEditMode } = useEditMode();
  const subjectName = useSubjectName(occurrence.details.subjectId);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { details } = occurrence;
  const coords = useFloatingPosition(anchorRef, popoverRef, true, align);
  const openHomework = useHomeworkDialog((state) => state.open);
  // ДЗ этой пары: тот же предмет и та же дата (id занятий у нас и на сайте группы разные)
  const allHomework = useHomeworkStore((state) => state.items);
  const homework = allHomework.filter((item) => item.lessonDate === occurrence.date && item.subject === subjectName);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!popoverRef.current?.contains(target) && !anchorRef.current?.contains(target)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    function handleScrollOrResize() {
      onClose();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const address = [details.room && `Ауд. ${details.room}`, details.building].filter(Boolean).join(', ');
  const mapUrl = details.building ? `https://yandex.ru/maps/?text=${encodeURIComponent(`Санкт-Петербург, ${details.building}`)}` : undefined;
  if (!coords) return null;

  return createPortal(
    <motion.div
      ref={popoverRef}
      role="dialog"
      aria-label={`Детали занятия: ${subjectName}`}
      className={styles.popover}
      style={{ position: 'fixed', left: coords.left, top: coords.top, bottom: coords.bottom }}
      initial={{ opacity: 0, scale: 0.92, y: coords.bottom !== undefined ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.11 } }}
      transition={SPRING_SNAPPY}
      onClick={(event) => event.stopPropagation()}
    >
      <Badge tone={CLASS_TYPE_TONES[details.type]}>{CLASS_TYPE_LABELS[details.type]}</Badge>
      <p className={styles.subject}>{subjectName}</p>

      <div className={styles.rows}>
        <div className={styles.row}>
          <User size={14} strokeWidth={1.75} className={styles.icon} aria-hidden />
          <span>{details.teacher}</span>
        </div>
        {address && (
          <div className={styles.row}>
            <MapPin size={14} strokeWidth={1.75} className={styles.icon} aria-hidden />
            {mapUrl ? (
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className={styles.mapLink}>
                {address} ↗
              </a>
            ) : (
              <span>{address}</span>
            )}
          </div>
        )}
        {details.subgroup && (
          <div className={styles.row}>
            <Users size={14} strokeWidth={1.75} className={styles.icon} aria-hidden />
            <span>{details.subgroup}</span>
          </div>
        )}
        <div className={styles.row}>
          <Clock size={14} strokeWidth={1.75} className={styles.icon} aria-hidden />
          <span>
            {details.startTime}–{details.endTime}
          </span>
        </div>
      </div>

      {homework.length > 0 && (
        <div className={styles.homework}>
          <p className={styles.homeworkTitle}>Домашнее задание · {homework.length}</p>
          {homework.map((item) => (
            <HomeworkCard key={item.id} item={item} today={occurrence.date} compact />
          ))}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        icon={Plus}
        className={styles.editButton}
        onClick={() => {
          openHomework({ lesson: { date: occurrence.date, id: occurrence.classId ?? '', start: details.startTime, subject: subjectName } });
          onClose();
        }}
      >
        Добавить ДЗ
      </Button>

      {isEditMode && (
        <Button variant="secondary" size="sm" icon={Pencil} className={styles.editButton} onClick={onEdit}>
          Редактировать
        </Button>
      )}
    </motion.div>,
    document.body,
  );
}
