import { Eye, Pencil } from 'lucide-react';
import { useEditMode } from '../../features/settings/EditModeContext';
import { cn } from '../../lib/cn';
import styles from './EditModeToggle.module.css';

/** Переключатель режима просмотра/редактирования. Показывает текущий режим. Скрыт у student — переключать нечего. */
export function EditModeToggle() {
  const { isEditMode, toggleEditMode, canToggleEditMode } = useEditMode();
  const Icon = isEditMode ? Pencil : Eye;

  if (!canToggleEditMode) return null;

  const label = isEditMode ? 'Редактирование' : 'Просмотр';

  return (
    <button
      type="button"
      className={cn(styles.toggle, isEditMode && styles.active)}
      aria-pressed={isEditMode}
      aria-label={label}
      title={label}
      onClick={toggleEditMode}
    >
      <Icon size={14} strokeWidth={1.75} aria-hidden />
      <span className={styles.label} aria-hidden>
        {label}
      </span>
    </button>
  );
}
