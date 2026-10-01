import { create } from 'zustand';
import { autoSyncGithubContent, syncGithubContent, type SyncSummary } from './githubContent';

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

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
    if (get().status === 'syncing') return;
    set({ status: 'syncing', error: '' });
    try {
      const summary = await task();
      set((state) => ({ status: 'done', summary: summary ?? state.summary }));
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Не удалось синхронизироваться с GitHub.' });
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
