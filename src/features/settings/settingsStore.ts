import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { localStore, storageKey } from '../../lib/storage';
import type { ThemePreference } from '../../types/models';

/**
 * Настройки интерфейса конкретного браузера — НЕ пользовательские данные, поэтому
 * не входят в резервную копию и не сбрасываются вместе с данными.
 */
interface LocalSettings {
  theme: ThemePreference;
  /** Режим редактирования: показывать ли кнопки добавления/изменения/удаления. */
  editMode: boolean;
  /** Цвет акцента: id готового (appearance.ts) или свой — «#rrggbb» */
  accent: string;
  /** Фон-сияние: медленные пятна света в цвете акцента за страницей */
  aurora: boolean;
  /** Свечение карточек: подсветка под курсором и светящиеся кнопки */
  glow: boolean;
  /** Живой фон: пятна сияния плавно следуют за курсором и прокруткой */
  liveBg: boolean;
  radius: RadiusPreference;
  /** PDF в тёмных тонах: страницы инвертируются (кнопка в панели PDF) */
  pdfDark: boolean;
  /** Главная: порядок блоков и скрытые (features/today/homeLayout.ts) */
  homeOrder: string[];
  homeHidden: string[];
  /** Что открывается при заходе на сайт */
  startPage: string;
  /** Плотность интерфейса: compact — меньше отступов везде */
  density: Density;
  /** Боковое меню свёрнуто (кнопка в меню и шапке, Ctrl+B) */
  sidebarCollapsed: boolean;
}

export type Density = 'comfortable' | 'compact';

export type RadiusPreference = 'sharp' | 'normal' | 'round';

interface SettingsStore extends LocalSettings {
  setTheme: (theme: ThemePreference) => void;
  setEditMode: (editMode: boolean) => void;
  toggleSidebar: () => void;
  setAppearance: (
    patch: Partial<
      Pick<LocalSettings, 'accent' | 'aurora' | 'glow' | 'liveBg' | 'radius' | 'pdfDark' | 'homeOrder' | 'homeHidden' | 'startPage' | 'density'>
    >,
  ) => void;
}

const DEFAULT_SETTINGS: LocalSettings = {
  theme: 'system',
  /** По умолчанию — режим просмотра, интерфейс максимально чистый */
  editMode: false,
  accent: 'indigo',
  aurora: true,
  glow: true,
  liveBg: true,
  radius: 'normal',
  pdfDark: false,
  homeOrder: [],
  homeHidden: [],
  startPage: '/today',
  density: 'comfortable',
  sidebarCollapsed: false,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setTheme: (theme) => set({ theme }),
      setEditMode: (editMode) => set({ editMode }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setAppearance: (patch) => set(patch),
    }),
    {
      name: storageKey('settings'),
      storage: localStore,
      version: 2,
    },
  ),
);
