import { Link } from 'react-router';
import { ListItem } from '../../components/ui/List';
import { formatShortDate } from '../../lib/dates';
import { pluralize } from '../../lib/pluralize';
import { useClock } from '../../lib/useClock';
import { useCursorGlow } from '../../lib/useCursorGlow';
import { usePrefersReducedMotion } from '../../lib/motion';
import type { Subject } from '../../types/models';
import { useMaterialsStore } from '../materials/materialsStore';
import { useTasksStore } from '../tasks/tasksStore';
import { getNextDeadline, getOpenTasks } from './subjectStats';
import styles from './SubjectRow.module.css';

interface SubjectRowProps {
  subject: Subject;
}

/** Строка предмета: буква-монограмма, название (ссылка на страницу предмета), преподаватель, счётчики, ближайший дедлайн. */
export function SubjectRow({ subject }: SubjectRowProps) {
  const { today } = useClock();
  const tasks = useTasksStore((state) => state.tasks);
  const materials = useMaterialsStore((state) => state.materials);
  const glow = useCursorGlow();
  const reduceMotion = usePrefersReducedMotion();

  const openTaskCount = getOpenTasks(tasks, subject.id).length;
  const materialCount = materials.filter((material) => material.subjectId === subject.id).length;
  const nextDeadline = getNextDeadline(tasks, subject.id, today);

  return (
    <ListItem
      className={styles.row}
      {...glow}
      leading={
        <span className={styles.monogram} aria-hidden>
          {subject.name.charAt(0)}
        </span>
      }
      title={
        <Link
          to={`/subjects/${subject.id}`}
          viewTransition={!reduceMotion}
          className={styles.titleLink}
          style={{ viewTransitionName: `subject-title-${subject.id}` }}
        >
          {subject.name}
        </Link>
      }
      meta={subject.teacherPrimary ?? 'Преподаватель не указан'}
      trailing={
        <>
          <span className={styles.stat}>{pluralize(openTaskCount, ['задача', 'задачи', 'задач'])}</span>
          <span className={styles.stat}>{pluralize(materialCount, ['материал', 'материала', 'материалов'])}</span>
          <span className={styles.deadline}>{nextDeadline ? `Срок ${formatShortDate(nextDeadline)}` : 'Нет дедлайнов'}</span>
        </>
      }
    />
  );
}
