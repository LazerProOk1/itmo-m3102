import { Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useEditMode } from '../settings/EditModeContext';
import styles from './TabToolbar.module.css';

interface TabToolbarProps {
  /** Например, «3 tasks» */
  label: string;
  addLabel: string;
  onAdd: () => void;
  /** Личное (заметки, учебный план) — хранится в браузере, добавлять можно и без режима редактирования */
  personal?: boolean;
}

/** Строка над списком внутри вкладки: сколько элементов и кнопка добавления. */
export function TabToolbar({ label, addLabel, onAdd, personal = false }: TabToolbarProps) {
  const { isEditMode } = useEditMode();

  return (
    <div className={styles.toolbar}>
      <span className={styles.count}>{label}</span>
      {(personal || isEditMode) && (
        <Button variant="secondary" size="sm" icon={Plus} onClick={onAdd}>
          {addLabel}
        </Button>
      )}
    </div>
  );
}
