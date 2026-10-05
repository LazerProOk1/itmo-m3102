import { Clock, MapPin, NotebookText, Pencil, Plus, User, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SPRING_SNAPPY } from '../../lib/motion';
import { useFloatingPosition } from '../../lib/useFloatingPosition';
import { HomeworkCard } from '../homework/HomeworkCard';
import { useHomeworkDialog } from '../homework/HomeworkDialog';
import { useHomeworkStore } from '../homework/homeworkStore';
import { useLectureNotesStore } from '../materials/lectureNotesStore';
import { useEditMode } from '../settings/EditModeContext';
import { useSubjectName } from '../subjects/subjectsStore';
import { CLASS_TYPE_LABELS, CLASS_TYPE_TONES } from './labels';
import { labelMatches, lessonNumber } from './lessons';
import type { ClassOccurrence } from './occurrences';
import { useScheduleData } from './scheduleStore';
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
  // Конспект этой пары: она третья лекция по предмету — папка «Лекция 3» (или «Лекция 2-3») у группы
  const scheduleData = useScheduleData();
  const lesson = lessonNumber(occurrence, scheduleData);
  const allNotes = useLectureNotesStore((state) => state.lectureNotes);
  const lessonNotes = lesson
    ? allNotes.filter((note) => !note.archived && note.subjectId === details.subjectId && labelMatches(note.lectureNumber, lesson))
    : [];

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

      {lesson && (
        <div className={styles.homework}>
          <p className={styles.homeworkTitle}>
            {lesson.kind} {lesson.n} · конспект
          </p>
          {lessonNotes.length > 0 ? (
            lessonNotes.map((note) => (
              <Link key={note.id} to={`/materials/notes/${note.id}`} className={styles.noteLink} onClick={onClose}>
                <NotebookText size={14} strokeWidth={1.75} aria-hidden />
                {note.title}
              </Link>
            ))
          ) : (
            <p className={styles.noteEmpty}>
              Пока нет —{' '}
              <Link to={`/materials?s=${details.subjectId}`} onClick={onClose}>
                все конспекты предмета
              </Link>
            </p>
          )}
        </div>
      )}

      {homework.length > 0 && (
        <div className={styles.homework}>
          <p className={styles.homeworkTitle}>Домашнее задание · {homework.length}</p>
          {homework.map((item) => (
            <HomeworkCard key={item.id} item={item} today={occurrence.date} compact />
          ))}
        </div>
      )}

      {isEditMode && (
        <Button
          variant="ghost"
          size="sm"
          icon={Plus}
          className={styles.editButton}
          onClick={() => {
            openHomework({
              lesson: { date: occurrence.date, id: occurrence.classId ?? '', start: details.startTime, subject: subjectName },
            });
            onClose();
          }}
        >
          Добавить ДЗ
        </Button>
      )}

      {isEditMode && (
        <Button variant="secondary" size="sm" icon={Pencil} className={styles.editButton} onClick={onEdit}>
          Редактировать
        </Button>
      )}
    </motion.div>,
    document.body,
  );
}
