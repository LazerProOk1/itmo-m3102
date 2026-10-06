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
  /** Второй акцент для градиента: 'auto' — тот же цвет, повёрнутый по оттенку, или id готового цвета */
  accent2: string;
  /** «Стекло»: шапка и меню полупрозрачные с размытием (на слабых телефонах дорого — по умолчанию выключено) */
  glass: boolean;
  /** Динамическая тема: сама меняет пару акцентов — при запуске, раз в 15 минут или раз в час */
  dynamicTheme: DynamicTheme;
  /** Фон-сияние: медленные пятна света в цвете акцента за страницей */
  aurora: boolean;
  /** Свечение карточек: подсветка под курсором и светящиеся кнопки */
  glow: boolean;
  /** Живой фон: пятна сияния плавно следуют за курсором и прокруткой */
  liveBg: boolean;
  radius: RadiusPreference;
  /** PDF в тёмных тонах (кнопка в панели PDF); null — как тема сайта */
  pdfDark: boolean | null;
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

export type DynamicTheme = 'off' | 'launch' | '15' | '60';

export type Density = 'comfortable' | 'compact';

export type RadiusPreference = 'sharp' | 'normal' | 'round';

interface SettingsStore extends LocalSettings {
  setTheme: (theme: ThemePreference) => void;
  setEditMode: (editMode: boolean) => void;
  toggleSidebar: () => void;
  setAppearance: (
    patch: Partial<
      Pick<
        LocalSettings,
        | 'accent'
        | 'accent2'
        | 'dynamicTheme'
        | 'glass'
        | 'aurora'
        | 'glow'
        | 'liveBg'
        | 'radius'
        | 'pdfDark'
        | 'homeOrder'
        | 'homeHidden'
        | 'startPage'
        | 'density'
      >
    >,
  ) => void;
}

const DEFAULT_SETTINGS: LocalSettings = {
  theme: 'system',
  /** По умолчанию — режим просмотра, интерфейс максимально чистый */
  editMode: false,
  accent: 'indigo',
  accent2: 'rose',
  dynamicTheme: 'off',
  glass: false,
  aurora: true,
  glow: true,
  liveBg: true,
  radius: 'normal',
  pdfDark: null,
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
      version: 4,
      // v3: вариант «Случайно» убрали (лагал) — заменяем на «15 мин»; v4: pdfDark по умолчанию null (как тема), старое false было значением по умолчанию
      migrate: (stored) => {
        const state = stored as Omit<Partial<LocalSettings>, 'dynamicTheme'> & { dynamicTheme?: string };
        if (state.dynamicTheme === 'random') state.dynamicTheme = '15';
        if ((state as { pdfDark?: boolean | null }).pdfDark === false) (state as { pdfDark?: boolean | null }).pdfDark = null;
        return state as LocalSettings;
      },
    },
  ),
);
