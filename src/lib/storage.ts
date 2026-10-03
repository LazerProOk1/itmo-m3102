import type { PersistStorage, StorageValue } from 'zustand/middleware';

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

/**
 * Отложенная запись для больших хранилищ (конспекты — ~1 МБ текста): JSON.stringify и localStorage.setItem
 * синхронные и на телефоне занимают ~100 мс. Пишем, когда браузер свободен, а при уходе со страницы — сразу,
 * чтобы ничего не потерять. Подключение: persist(..., { name, storage: idleStorage<State>() }).
 */
export function idleStorage<S>(): PersistStorage<S> {
  const pending = new Map<string, StorageValue<S>>();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    for (const [name, value] of pending) localStorage.setItem(name, JSON.stringify(value));
    pending.clear();
  };
  // Вне браузера (юнит-тесты в Node) хранить негде
  const available = typeof localStorage !== 'undefined';
  if (available) {
    addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  }
  return {
    getItem: (name) => {
      const raw = available ? localStorage.getItem(name) : null;
      return raw ? (JSON.parse(raw) as StorageValue<S>) : null;
    },
    setItem: (name, value) => {
      if (!available) return;
      pending.set(name, value);
      if (scheduled) return;
      scheduled = true;
      (window.requestIdleCallback ?? ((callback: () => void) => setTimeout(callback, 300)))(flush, { timeout: 2000 });
    },
    removeItem: (name) => {
      pending.delete(name);
      if (available) localStorage.removeItem(name);
    },
  };
}
