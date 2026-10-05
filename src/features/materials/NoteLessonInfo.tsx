import { Link } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { addDays, formatDayLabel } from '../../lib/dates';
import { useClock } from '../../lib/useClock';
import type { LectureNote } from '../../types/models';
import { CLASS_TYPE_LABELS } from '../schedule/labels';
import { lessonDate } from '../schedule/lessons';
import { nextOccurrence } from '../schedule/occurrences';
import { useScheduleData } from '../schedule/scheduleStore';
import styles from './NoteLessonInfo.module.css';

/**
 * Под заголовком конспекта — его связи: предмет (ссылкой на страницу предмета), когда была пара к этому конспекту
 * («Лекция 3» — третья лекция по предмету) и когда следующая пара — читать перед ней.
 */
export function NoteLessonInfo({ note, subjectName }: { note: LectureNote; subjectName?: string }) {
  const { today, time } = useClock();
  const data = useScheduleData();
  if (!subjectName) return null;
  const held = lessonDate(note.subjectId, note.lectureNumber, data, addDays(today, 90));
  const next = nextOccurrence(note.subjectId, today, time, data);

  return (
    <p className={styles.info}>
      <Link to={`${SECTIONS.subjects.path}/${note.subjectId}`}>{subjectName}</Link>
      {held && (
        <span>
          {note.lectureNumber} {held <= today ? 'была' : 'будет'} {formatDayLabel(held, today, 'long').toLowerCase()}
        </span>
      )}
      {next && (
        <span>
          Следующая пара — {formatDayLabel(next.date, today, 'long').toLowerCase()}, {next.details.startTime} (
          {CLASS_TYPE_LABELS[next.details.type].toLowerCase()})
        </span>
      )}
    </p>
  );
}
