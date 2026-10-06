import { CalendarClock, Clock, ListChecks, Repeat2 } from 'lucide-react';
import { Link } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { buttonClass } from '../../components/ui/Button';
import { addDays, formatDayLabel, formatWeekdayDate } from '../../lib/dates';
import { pluralize } from '../../lib/pluralize';
import type { ISODate } from '../../types/models';
import { QuizProgressBar, useSubjectQuizProgress } from '../quizzes/QuizProgress';
import { dueCards, useQuizStore } from '../quizzes/quizStore';
import { CLASS_TYPE_LABELS } from '../schedule/labels';
import { nextOccurrence } from '../schedule/occurrences';
import { useScheduleData } from '../schedule/scheduleStore';
import styles from './SubjectCover.module.css';

interface SubjectCoverProps {
  subjectId: string;
  today: ISODate;
  time: string;
  nextDeadline?: ISODate;
}

/** Шапка предмета: когда следующая пара, ближайший срок и как идут тесты — главное без переключения вкладок */
export function SubjectCover({ subjectId, today, time, nextDeadline }: SubjectCoverProps) {
  const schedule = useScheduleData();
  const next = nextOccurrence(subjectId, today, time, schedule);
  const progress = useSubjectQuizProgress(subjectId);
  const keys = new Set(progress.sources.map((source) => source.key));
  const due = useQuizStore((state) => dueCards(state.review, today).filter((card) => keys.has(card.quiz)).length);

  return (
    <section className={`${styles.cover} stagger`} aria-label="Коротко о предмете">
      <div className={styles.card} data-spot>
        <span className={styles.label}>
          <CalendarClock size={14} strokeWidth={1.75} aria-hidden /> Следующая пара
        </span>
        {next ? (
          <>
            <strong className={styles.value}>
              {next.date <= addDays(today, 1) ? formatDayLabel(next.date, today) : formatWeekdayDate(next.date)}, {next.details.startTime}
            </strong>
            <span className={styles.sub}>
              {CLASS_TYPE_LABELS[next.details.type]}
              {next.details.room && ` · ауд. ${next.details.room}`}
            </span>
          </>
        ) : (
          <strong className={styles.value}>Не в ближайшие три недели</strong>
        )}
      </div>

      <div className={styles.card} data-spot>
        <span className={styles.label}>
          <Clock size={14} strokeWidth={1.75} aria-hidden /> Ближайший срок
        </span>
        <strong className={styles.value}>{nextDeadline ? formatDayLabel(nextDeadline, today, 'long') : 'Сроков нет'}</strong>
        <span className={styles.sub}>{nextDeadline ? 'Дедлайн или задача по предмету' : 'Можно выдохнуть'}</span>
      </div>

      <div className={styles.card} data-spot>
        <span className={styles.label}>
          <ListChecks size={14} strokeWidth={1.75} aria-hidden /> Тесты
        </span>
        {progress.total ? (
          <>
            <strong className={styles.value}>
              {progress.passed} из {progress.total}
              <span className={styles.muted}> пройдено</span>
            </strong>
            <QuizProgressBar passed={progress.passed} total={progress.total} className={styles.bar} />
            <span className={styles.actions}>
              <Link to={`/subjects/${subjectId}/exam`} className={buttonClass('primary', 'sm')}>
                Перед контрольной
              </Link>
              {due > 0 && (
                <Link to={SECTIONS.review.path} className={buttonClass('secondary', 'sm')}>
                  <Repeat2 size={14} strokeWidth={1.75} aria-hidden />
                  {pluralize(due, ['вопрос', 'вопроса', 'вопросов'])}
                </Link>
              )}
            </span>
          </>
        ) : (
          <strong className={styles.value}>Тестов пока нет</strong>
        )}
      </div>
    </section>
  );
}
