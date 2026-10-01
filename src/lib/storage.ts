/**
 * Все данные приложения хранятся в localStorage браузера.
 *
 * Каждое хранилище (store) — отдельный ключ: "m3102:settings",
 * "m3102:tasks" и т. д. Так данные легко посмотреть
 * (DevTools → Application → Local Storage), а позже — выгрузить в файл
 * или синхронизировать с Google Drive, не меняя сами stores.
 */
export const STORAGE_PREFIX = 'm3102';

/** storageKey('tasks') → "m3102:tasks" */
export function storageKey(name: string): string {
  return `${STORAGE_PREFIX}:${name}`;
}
