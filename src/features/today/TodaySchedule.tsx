import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { buttonClass } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { List } from '../../components/ui/List';
import { Section } from '../../components/ui/Section';
import { pluralize } from '../../lib/pluralize';
import type { ISODate } from '../../types/models';
import { DayOccurrenceRow } from '../schedule/DayOccurrenceRow';
import type { OccurrenceAction } from '../schedule/OccurrenceMenuItems';
import { takesPlace, type ClassOccurrence } from '../schedule/occurrences';

interface TodayScheduleProps {
  occurrences: ClassOccurrence[];
  today: ISODate;
  /** Текущее время "HH:mm" */
  time: string;
  onAction: (action: OccurrenceAction, occurrence: ClassOccurrence) => void;
}

/** Все занятия сегодняшнего дня, с учётом отмен и переносов. Текущее занятие подсвечено. */
export function TodaySchedule({ occurrences, today, time, onAction }: TodayScheduleProps) {
  const activeCount = occurrences.filter(takesPlace).length;

  return (
    <Section
      title="Сегодня"
      meta={pluralize(activeCount, ['пара', 'пары', 'пар'])}
      action={
        <Link to={SECTIONS.schedule.path} className={buttonClass('ghost', 'sm')}>
          Расписание
        </Link>
      }
    >
      {occurrences.length === 0 ? (
        <EmptyState compact icon={CalendarDays} title="Сегодня пар нет" />
      ) : (
        <List>
          {occurrences.map((occurrence) => (
            <DayOccurrenceRow key={occurrence.key} occurrence={occurrence} today={today} time={time} onAction={onAction} />
          ))}
        </List>
      )}
    </Section>
  );
}
