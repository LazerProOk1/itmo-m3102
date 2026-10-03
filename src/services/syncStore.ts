import { create } from 'zustand';
import { autoSyncGithubContent, syncGithubContent, type SyncSummary } from './githubContent';

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

const OFFLINE = 'Нет интернета — показаны сохранённые данные. Синхронизируемся, когда сеть вернётся.';

interface SyncStore {
  status: SyncStatus;
  /** Итог последней синхронизации или текст ошибки */
  summary: SyncSummary | null;
  error: string;
  /** Синхронизировать с репозиториями сейчас (кнопка). Повторный вызов во время синхронизации ничего не делает. */
  run: () => Promise<void>;
  /** При открытии сайта — не чаще раза в 10 минут */
  runAuto: () => Promise<void>;
}

/** Общее состояние синхронизации — его видят кнопка в шапке, «Настройки» и вкладка «Конспекты» */
export const useSyncStore = create<SyncStore>()((set, get) => {
  async function track(task: () => Promise<SyncSummary | void>) {
    // Статус ставится до первого await — второй вызов (StrictMode, кнопка + автосинхронизация) ничего не делает
    if (get().status === 'syncing') return;
    if (!navigator.onLine) {
      set({ status: 'error', error: OFFLINE });
      return;
    }
    set({ status: 'syncing', error: '' });
    try {
      const summary = await task();
      set((state) => ({ status: 'done', summary: summary ?? state.summary }));
    } catch (error) {
      // fetch без сети бросает TypeError «Failed to fetch» — человеку это ничего не говорит
      const message =
        error instanceof TypeError || !navigator.onLine
          ? OFFLINE
          : error instanceof DOMException && error.name === 'TimeoutError'
            ? 'GitHub не отвечает — показаны сохранённые данные. Попробуйте позже.'
            : error instanceof Error
              ? error.message
              : 'Не удалось синхронизироваться с GitHub.';
      set({ status: 'error', error: message });
    }
  }

  return {
    status: 'idle',
    summary: null,
    error: '',
    run: () => track(syncGithubContent),
    runAuto: () => track(autoSyncGithubContent),
  };
});
