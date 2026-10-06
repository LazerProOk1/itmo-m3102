import { Ellipsis } from 'lucide-react';
import { DropdownMenu } from '../../components/ui/DropdownMenu';
import { IconButton } from '../../components/ui/IconButton';
import { useEditMode } from '../settings/EditModeContext';
import { OccurrenceMenuItems, type OccurrenceAction } from './OccurrenceMenuItems';
import type { ClassOccurrence } from './occurrences';

interface OccurrenceMenuButtonProps {
  occurrence: ClassOccurrence;
  onAction: (action: OccurrenceAction, occurrence: ClassOccurrence) => void;
}

/** Кнопка «⋯» с меню действий занятия. Общая для дневного и недельного вида. Видна только в режиме редактирования. */
export function OccurrenceMenuButton({ occurrence, onAction }: OccurrenceMenuButtonProps) {
  const { isEditMode } = useEditMode();
  if (!isEditMode) return null;

  return (
    <DropdownMenu align="end" trigger={(props) => <IconButton icon={Ellipsis} label="Действия с парой" size="sm" {...props} />}>
      <OccurrenceMenuItems occurrence={occurrence} onAction={onAction} />
    </DropdownMenu>
  );
}
