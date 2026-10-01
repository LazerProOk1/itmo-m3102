import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../lib/cn';
import { formatDuration } from '../../lib/dates';
import { useCursorGlow } from '../../lib/useCursorGlow';
import { CLASS_TYPE_LABELS } from '../schedule/labels';
import type { ClassDetails } from '../../types/models';
import { useSubjectName } from '../subjects/subjectsStore';
import type { ClassStatus } from './classStatus';
import styles from './NextClassBlock.module.css';

interface NextClassBlockProps {
  status: ClassStatus;
}

/**
 * Главный блок Today: что идёт сейчас или что будет дальше.
 * Единственный блок в рамке на странице — чтобы сразу выделялся.
 */
export function NextClassBlock({ status }: NextClassBlockProps) {
  const glow = useCursorGlow();

  if (status.kind === 'finished') {
    return (
      <section className={styles.block} {...glow}>
        <div>
          <p className={styles.eyebrow}>Пар сегодня больше нет</p>
          {status.next ? (
            <>
              <p className={styles.title}>
                Следующая пара {status.next.dayLabel} в {status.next.occurrence.details.startTime}
              </p>
              <ClassDetailsLine details={status.next.occurrence.details} />
            </>
          ) : (
            <p className={styles.title}>Нет пар в ближайшие 7 дней</p>
          )}
        </div>
      </section>
    );
  }

  const isNow = status.kind === 'now';
  const { details } = status.occurrence;

  return (
    <section className={cn(styles.block, isNow && styles.now)} {...glow}>
      <div>
        <p className={styles.eyebrow}>
          {isNow && <span className={styles.liveDot} aria-hidden />}
          {isNow ? 'Сейчас' : 'Следующая пара'}
        </p>
        <p className={styles.title}>
          <SubjectName subjectId={details.subjectId} />
        </p>
        <ClassDetailsLine details={details} showTime />
      </div>

      {status.kind === 'now' ? (
        <p className={styles.countdown}>
          Закончится через{' '}
          {status.minutesLeft < 60 ? (
            <>
              <AnimatedNumber value={status.minutesLeft} /> мин
            </>
          ) : (
            formatDuration(status.minutesLeft)
          )}
        </p>
      ) : (
        <Badge tone="accent">через {formatDuration(status.minutesUntil)}</Badge>
      )}
    </section>
  );
}

function SubjectName({ subjectId }: { subjectId: string }) {
  return <>{useSubjectName(subjectId)}</>;
}

interface ClassDetailsLineProps {
  details: ClassDetails;
  showTime?: boolean;
}

function ClassDetailsLine({ details, showTime = false }: ClassDetailsLineProps) {
  return (
    <p className={styles.details}>
      {showTime && (
        <span>
          {details.startTime} — {details.endTime}
        </span>
      )}
      {details.room && <span>Аудитория {details.room}</span>}
      <span>{CLASS_TYPE_LABELS[details.type]}</span>
    </p>
  );
}
