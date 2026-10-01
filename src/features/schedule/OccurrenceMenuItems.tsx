import { ArrowRightLeft, Ban, Pencil, Replace, Trash, Undo2 } from 'lucide-react';
import { DropdownItem, DropdownLabel, DropdownSeparator } from '../../components/ui/DropdownMenu';
import { formatWeekdayDate } from '../../lib/dates';
import { getChangeDate, type ClassOccurrence } from './occurrences';

export type OccurrenceAction = 'editClass' | 'cancel' | 'move' | 'replace' | 'editException' | 'restore';

interface OccurrenceMenuItemsProps {
  occurrence: ClassOccurrence;
  onAction: (action: OccurrenceAction, occurrence: ClassOccurrence) => void;
}

/** Пункты меню занятия: изменить всё еженедельное занятие или только одну дату. */
export function OccurrenceMenuItems({ occurrence, onAction }: OccurrenceMenuItemsProps) {
  const select = (action: OccurrenceAction) => () => onAction(action, occurrence);

  if (occurrence.status === 'additional') {
    return (
      <>
        <DropdownLabel>Разовая пара</DropdownLabel>
        <DropdownItem icon={Pencil} onSelect={select('editException')}>
          Изменить
        </DropdownItem>
        <DropdownItem icon={Trash} onSelect={select('restore')}>
          Удалить
        </DropdownItem>
      </>
    );
  }

  return (
    <>
      <DropdownItem icon={Pencil} onSelect={select('editClass')}>
        Изменить еженедельную пару
      </DropdownItem>

      <DropdownSeparator />
      <DropdownLabel>Только {formatWeekdayDate(getChangeDate(occurrence))}</DropdownLabel>

      {occurrence.status === 'regular' ? (
        <>
          <DropdownItem icon={Ban} onSelect={select('cancel')}>
            Отменить пару
          </DropdownItem>
          <DropdownItem icon={ArrowRightLeft} onSelect={select('move')}>
            Перенести…
          </DropdownItem>
          <DropdownItem icon={Replace} onSelect={select('replace')}>
            Заменить…
          </DropdownItem>
        </>
      ) : (
        <>
          {occurrence.status !== 'cancelled' && (
            <DropdownItem icon={Pencil} onSelect={select('editException')}>
              Изменить правку…
            </DropdownItem>
          )}
          <DropdownItem icon={Undo2} onSelect={select('restore')}>
            Восстановить обычную пару
          </DropdownItem>
        </>
      )}
    </>
  );
}
