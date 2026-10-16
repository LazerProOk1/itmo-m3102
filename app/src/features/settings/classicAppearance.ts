import type { ClassicPalette } from '../../lib/classicPalettes';
import type { ThemePreference } from '../../types/models';
import type { RadiusPreference } from './settingsStore';

/** Что выбрано в классической версии: ключ m3102-settings-v1 общий с ней (тот же origin) */
export interface ClassicAppearance {
  palette?: string;
  theme?: string;
  radius?: string;
}

/** Только чтение: ничего не выбрано или хранилище закрыто — null */
export function readClassicAppearance(): ClassicAppearance | null {
  try {
    const raw = JSON.parse(localStorage.getItem('m3102-settings-v1') ?? 'null') as ClassicAppearance | null;
    if (!raw || typeof raw !== 'object') return null;
    const { palette, theme, radius } = raw;
    return palette || theme || radius ? { palette, theme, radius } : null;
  } catch {
    return null;
  }
}

export interface AppearanceChange {
  theme?: ThemePreference;
  patch: { accent?: string; accent2?: string; dynamicTheme?: 'off'; aurora?: boolean; glow?: boolean; liveBg?: boolean; radius?: RadiusPreference };
  /** Что именно поменяется — для строки «Готово: …» */
  summary: string[];
}

const THEMES: Record<string, [ThemePreference, string]> = {
  auto: ['system', 'тема как на устройстве'],
  light: ['light', 'светлая тема'],
  dark: ['dark', 'тёмная тема'],
};
// У классической пять степеней скругления, у нас три
const RADII: Record<string, RadiusPreference> = { bubbly: 'round', soft: 'round', classic: 'normal', firm: 'normal', strict: 'sharp' };

/** Палитра, тема и скругления классической версии → наши настройки. Шрифт у нас один, его не переносим */
export function classicToSettings(classic: ClassicAppearance, palettes: ClassicPalette[]): AppearanceChange {
  const change: AppearanceChange = { patch: {}, summary: [] };
  const palette = palettes.find((item) => item.id === classic.palette);
  if (palette) {
    // Динамическая тема перекрывает акценты — для выбранной палитры её выключаем
    Object.assign(change.patch, { accent: palette.a, accent2: palette.b, dynamicTheme: 'off' });
    change.summary.push(`палитра «${palette.name}»`);
  }
  const theme = classic.theme ? THEMES[classic.theme] : undefined;
  if (theme) {
    change.theme = theme[0];
    change.summary.push(theme[1]);
  }
  const radius = classic.radius ? RADII[classic.radius] : undefined;
  if (radius) {
    change.patch.radius = radius;
    change.summary.push('скругления');
  }
  return change;
}

/** «Как в классической версии»: её палитра по умолчанию, без сияния, свечения и живого фона, обычные скругления */
export function classicPreset(palettes: ClassicPalette[], defaultId: string): AppearanceChange {
  const palette = palettes.find((item) => item.id === defaultId) ?? palettes[0];
  return {
    patch: {
      ...(palette && { accent: palette.a, accent2: palette.b }),
      dynamicTheme: 'off',
      aurora: false,
      glow: false,
      liveBg: false,
      radius: 'normal',
    },
    summary: [...(palette ? [`палитра «${palette.name}»`] : []), 'без сияния и свечения'],
  };
}
