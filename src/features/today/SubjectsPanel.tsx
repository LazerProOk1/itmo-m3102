import { Repeat2 } from 'lucide-react';
import { Link } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { buttonClass } from '../../components/ui/Button';
import { Section } from '../../components/ui/Section';
import { addDays, formatDayLabel, getShortWeekdayName } from '../../lib/dates';
import { pluralize } from '../../lib/pluralize';
import type { ISODate, Subject } from '../../types/models';
import { QuizProgressBar, useSubjectQuizProgress } from '../quizzes/QuizProgress';
import { dueCards, useQuizStore } from '../quizzes/quizStore';
import { nextOccurrence, type ScheduleData } from '../schedule/occurrences';
import { useScheduleData } from '../schedule/scheduleStore';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { SectionLink } from './HomePanels';
import styles from './SubjectsPanel.module.css';

function SubjectLine({ subject, today, time, schedule }: { subject: Subject; today: ISODate; time: string; schedule: ScheduleData }) {
  const next = nextOccurrence(subject.id, today, time, schedule);
  const progress = useSubjectQuizProgress(subject.id);
  const day = next && (next.date <= addDays(today, 1) ? formatDayLabel(next.date, today) : getShortWeekdayName(next.date));

  return (
    <li>
      <Link to={`/subjects/${subject.id}`} className={styles.line} data-spot data-morph>
        <span className={styles.name} data-morph-title>
          {subject.name}
        </span>
        <span className={styles.next}>{next ? `${day}, ${next.details.startTime}` : '—'}</span>
        {progress.total > 0 && (
          <span className={styles.progress} title={`Тесты: пройдено ${progress.passed} из ${progress.total}`}>
            <QuizProgressBar passed={progress.passed} total={progress.total} />
            <small>
              {progress.passed}/{progress.total}
            </small>
          </span>
        )}
      </Link>
    </li>
  );
}

/** Предметы на главной: когда следующая пара и сколько тестов «Проверь себя» пройдено */
export function SubjectsPanel({ today, time }: { today: ISODate; time: string }) {
  const subjects = useSubjectsStore((state) => state.subjects);
  const schedule = useScheduleData();

  return (
    <Section title="Предметы" action={<SectionLink to={SECTIONS.subjects.path}>Все предметы</SectionLink>}>
      <ul className={styles.list}>
        {subjects.map((subject) => (
          <SubjectLine key={subject.id} subject={subject} today={today} time={time} schedule={schedule} />
        ))}
      </ul>
    </Section>
  );
}

/** Напоминание на главной, когда есть вопросы на повторение */
export function ReviewBanner({ today }: { today: ISODate }) {
  const due = useQuizStore((state) => dueCards(state.review, today).length);
  if (!due) return null;
  return (
    <Link to={SECTIONS.review.path} className={styles.banner} data-spot>
      <Repeat2 size={18} strokeWidth={1.75} aria-hidden />
      <span>
        <strong>Повторение</strong> · {pluralize(due, ['вопрос', 'вопроса', 'вопросов'])} из тестов, где вы ошиблись
      </span>
      <span className={buttonClass('primary', 'sm')}>Повторить</span>
    </Link>
  );
}
