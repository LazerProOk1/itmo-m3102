import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSettingsStore } from './settingsStore';

interface EditModeValue {
  isEditMode: boolean;
  toggleEditMode: () => void;
  canToggleEditMode: boolean;
}

const EditModeContext = createContext<EditModeValue | null>(null);

/**
 * Редактирование на сайте включается при сборке: VITE_EDITING=true в .env ветки react-app-dev.
 * В ветке react-app сайт только для просмотра — переключателя нет, правок нет.
 */
export const EDITING_ENABLED = import.meta.env.VITE_EDITING === 'true';

/**
 * Режим редактирования: по умолчанию сайт открывается в режиме просмотра — кнопки
 * добавления/изменения/удаления скрыты. Переключатель живёт в localStorage.
 */
export function EditModeProvider({ children }: { children: ReactNode }) {
  const editModeSetting = useSettingsStore((state) => state.editMode);
  const setEditMode = useSettingsStore((state) => state.setEditMode);

  const value = useMemo<EditModeValue>(
    () => ({
      isEditMode: EDITING_ENABLED && editModeSetting,
      toggleEditMode: () => setEditMode(!editModeSetting),
      canToggleEditMode: EDITING_ENABLED,
    }),
    [editModeSetting, setEditMode],
  );

  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>;
}

export function useEditMode(): EditModeValue {
  const value = useContext(EditModeContext);
  if (!value) throw new Error('useEditMode must be used within EditModeProvider');
  return value;
}
