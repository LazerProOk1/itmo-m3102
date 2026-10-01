import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSettingsStore } from './settingsStore';

interface EditModeValue {
  isEditMode: boolean;
  toggleEditMode: () => void;
  canToggleEditMode: boolean;
}

const EditModeContext = createContext<EditModeValue | null>(null);

/**
 * Режим редактирования: по умолчанию приложение открывается в режиме просмотра —
 * кнопки добавления/изменения/удаления скрыты. Переключатель живёт в localStorage.
 */
export function EditModeProvider({ children }: { children: ReactNode }) {
  const editModeSetting = useSettingsStore((state) => state.editMode);
  const setEditMode = useSettingsStore((state) => state.setEditMode);

  const value = useMemo<EditModeValue>(
    () => ({
      isEditMode: editModeSetting,
      toggleEditMode: () => setEditMode(!editModeSetting),
      canToggleEditMode: true,
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
