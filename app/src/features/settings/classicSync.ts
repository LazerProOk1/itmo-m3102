import classicPalettes from 'virtual:classic-palettes';
import { storageKey } from '../../lib/storage';
import type { ThemePreference } from '../../types/models';
import { useSettingsStore, type RadiusPreference } from './settingsStore';

/**
 * Оформление общее с классической версией: тот же origin, её ключ m3102-settings-v1 (палитра, тема, скругления; шрифт у нас один,
 * его не трогаем). Меняешь здесь — меняется там, и наоборот. Побеждает тот, кто менял последним: «прошлая сверка» (`SEEN_KEY`) помнит,
 * что в её ключе было, когда мы смотрели в последний раз.
 */
const CLASSIC_KEY = 'm3102-settings-v1';
const SEEN_KEY = storageKey('appearance-sync');

export interface ClassicLook {
  palette?: string;
  theme?: string;
  radius?: string;
}

export interface AppLook {
  theme: ThemePreference;
  accent: string;
  accent2: string;
  radius: RadiusPreference;
}

interface Palette {
  id: string;
  a: string;
  b: string;
}

const THEME_FROM: Record<string, ThemePreference> = { auto: 'system', light: 'light', dark: 'dark' };
const THEME_TO: Record<ThemePreference, string> = { system: 'auto', light: 'light', dark: 'dark' };
// У классической пять степеней скругления, у нас три; «мягкие» и «округлые» у неё — наши «мягкие»
const RADIUS_FROM: Record<string, RadiusPreference> = { bubbly: 'round', soft: 'round', classic: 'normal', firm: 'normal', strict: 'sharp' };
const RADIUS_TO: Record<RadiusPreference, string> = { sharp: 'strict', normal: 'classic', round: 'soft' };

export interface AppChange {
  theme?: ThemePreference;
  patch: { accent?: string; accent2?: string; dynamicTheme?: 'off'; radius?: RadiusPreference };
}

/** Что в классической изменилось с прошлой сверки → наши настройки. Значение, которого она не выбирала, не трогаем */
export function fromClassic(classic: ClassicLook, seen: ClassicLook, palettes: Palette[]): { change: AppChange; seen: ClassicLook } {
  const change: AppChange = { patch: {} };
  const next = { ...seen };
  const palette = classic.palette && classic.palette !== seen.palette ? palettes.find((item) => item.id === classic.palette) : undefined;
  if (palette) {
    // Динамическая тема перекрывает акценты — для выбранной палитры её выключаем
    Object.assign(change.patch, { accent: palette.a, accent2: palette.b, dynamicTheme: 'off' });
    next.palette = palette.id;
  }
  if (classic.theme && classic.theme !== seen.theme && THEME_FROM[classic.theme]) {
    change.theme = THEME_FROM[classic.theme];
    next.theme = classic.theme;
  }
  if (classic.radius && classic.radius !== seen.radius && RADIUS_FROM[classic.radius]) {
    change.patch.radius = RADIUS_FROM[classic.radius];
    next.radius = classic.radius;
  }
  return { change, seen: next };
}

/**
 * Наши настройки → ключ классической: только то, что у неё отличается. Свои цвета и пары приложения у неё выразить нечем —
 * её палитра остаётся как была.
 */
export function toClassic(
  app: AppLook,
  classic: ClassicLook,
  seen: ClassicLook,
  palettes: Palette[],
  defaultId: string,
): { write: ClassicLook; seen: ClassicLook } {
  const write: ClassicLook = {};
  const theme = classic.theme && THEME_FROM[classic.theme] ? classic.theme : 'auto';
  if (THEME_FROM[theme] !== app.theme) write.theme = THEME_TO[app.theme];
  const radius = classic.radius && RADIUS_FROM[classic.radius] ? classic.radius : 'classic';
  if (RADIUS_FROM[radius] !== app.radius) write.radius = RADIUS_TO[app.radius];
  const same = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();
  const palette = palettes.find((item) => same(item.a, app.accent) && same(item.b, app.accent2));
  const current = classic.palette && palettes.some((item) => item.id === classic.palette) ? classic.palette : defaultId;
  if (palette && palette.id !== current) write.palette = palette.id;
  return { write, seen: { ...seen, ...write } };
}

function readJson(key: string): ClassicLook {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return value && typeof value === 'object' ? (value as ClassicLook) : {};
  } catch {
    return {};
  }
}

const writeJson = (key: string, value: object) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Хранилище закрыто или переполнено — оформление просто останется у каждой версии своим
  }
};

let pulling = false;

/** Классическая → приложение: то, что она поменяла с прошлой сверки */
export function pullFromClassic(): void {
  const { change, seen } = fromClassic(readJson(CLASSIC_KEY), readJson(SEEN_KEY), classicPalettes.palettes);
  if (!change.theme && Object.keys(change.patch).length === 0) return;
  const store = useSettingsStore.getState();
  // Пока применяем, обратно не пишем: промежуточное состояние перетёрло бы остальные её изменения
  pulling = true;
  try {
    if (change.theme) store.setTheme(change.theme);
    if (Object.keys(change.patch).length > 0) store.setAppearance(change.patch);
  } finally {
    pulling = false;
  }
  writeJson(SEEN_KEY, seen);
}

/** Приложение → классическая: то, что у неё отличается от наших настроек (её остальные ключи, например шрифт, остаются) */
export function pushToClassic(): void {
  if (pulling) return;
  const { theme, accent, accent2, radius } = useSettingsStore.getState();
  const classic = readJson(CLASSIC_KEY);
  const { write, seen } = toClassic(
    { theme, accent, accent2, radius },
    classic,
    readJson(SEEN_KEY),
    classicPalettes.palettes,
    classicPalettes.defaultId,
  );
  if (Object.keys(write).length === 0) return;
  writeJson(CLASSIC_KEY, { ...classic, ...write });
  writeJson(SEEN_KEY, seen);
}

/** Запуск при открытии приложения: сначала берём изменения классической, потом отдаём наши; дальше — в обе стороны на лету */
export function startClassicSync(): void {
  pullFromClassic();
  pushToClassic();
  useSettingsStore.subscribe(pushToClassic);
  // Классическая открыта в соседней вкладке и поменяла своё — подхватываем сразу
  addEventListener('storage', (event) => {
    if (event.key === CLASSIC_KEY) pullFromClassic();
  });
  // Вернулись «Назад» из кеша браузера — за это время классическая могла поменять своё
  addEventListener('pageshow', (event) => {
    if (event.persisted) pullFromClassic();
  });
}
