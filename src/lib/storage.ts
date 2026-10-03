import { createJSONStorage, type PersistStorage, type StorageValue } from 'zustand/middleware';

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

/** Кеш контента из GitHub: при нехватке места его можно выбросить — следующая синхронизация скачает заново */
const DISPOSABLE = ['lecture-notes', 'subject-info'].map(storageKey);
let warned = false;

/**
 * localStorage для persist личных данных. Место кончилось (квота ~5 МБ) — сначала освобождаем кеш конспектов
 * и пишем ещё раз: иначе отметка «сделано» или заметка молча не сохранится и пропадёт после перезагрузки.
 * Не помогло — говорим человеку, а не теряем данные тихо.
 */
function saveWithRoom(name: string, value: string) {
  try {
    localStorage.setItem(name, value);
    return;
  } catch {
    for (const key of DISPOSABLE) if (key !== name) localStorage.removeItem(key);
  }
  try {
    localStorage.setItem(name, value);
  } catch (error) {
    console.error(`Не удалось сохранить ${name}`, error);
    if (!warned) {
      warned = true;
      alert('Браузеру не хватает места: последние изменения не сохранятся после перезагрузки. Освободите место для сайта в настройках браузера.');
    }
  }
}

export const localStore = createJSONStorage(() => {
  // Вне браузера (юнит-тесты в Node) — как у persist по умолчанию: без хранилища
  if (typeof localStorage === 'undefined') throw new Error('no localStorage');
  return { getItem: (name) => localStorage.getItem(name), setItem: saveWithRoom, removeItem: (name) => localStorage.removeItem(name) };
});

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
    for (const [name, value] of pending) {
      try {
        localStorage.setItem(name, JSON.stringify(value));
      } catch (error) {
        // Место кончилось (квота ~5 МБ) — в этой вкладке данные есть, при следующем открытии скачаются заново
        console.warn(`Не удалось сохранить ${name}`, error);
      }
    }
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
      try {
        return raw ? (JSON.parse(raw) as StorageValue<S>) : null;
      } catch {
        // Запись оборвалась на середине — начинаем с пустого, синхронизация всё вернёт
        localStorage.removeItem(name);
        return null;
      }
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
