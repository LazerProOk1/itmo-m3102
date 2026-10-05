import { create } from 'zustand';
import { storageKey } from '../../lib/storage';
import { GROUP_REPO, githubFetch } from '../../services/github';

/** Коммиты в репозиторий группы — раз в час: один запрос к API на всех (contributors), лимит 60 в час */
const COMMITS_TTL = 60 * 60_000;
const COMMITS_KEY = storageKey('contributors');

interface ProfileStore {
  /** GitHub-логин открытого профиля */
  login: string | null;
  /** Профиль уже открывали — окно загружено и остаётся в DOM */
  used: boolean;
  /** Логин → коммитов в репозиторий группы; null — ещё не загружено или GitHub недоступен */
  commits: Record<string, number> | null;
  open: (login: string) => void;
  close: () => void;
  loadCommits: () => Promise<void>;
}

function cachedCommits(): { at: number; commits: Record<string, number> } | null {
  try {
    return JSON.parse(localStorage.getItem(COMMITS_KEY) ?? 'null');
  } catch {
    return null;
  }
}

/**
 * Профиль студента открывается из любого места (карточка на «Студентах», имя в очереди дедлайна) — окно одно,
 * в AppShell. Своё состояние, а не адрес: смена адреса перерисовывает всё приложение, и окно «застывало».
 */
export const useProfileStore = create<ProfileStore>()((set, get) => ({
  login: null,
  used: false,
  commits: cachedCommits()?.commits ?? null,
  open: (login) => {
    set({ login, used: true });
    void get().loadCommits();
  },
  close: () => set({ login: null }),
  loadCommits: async () => {
    if (Date.now() - (cachedCommits()?.at ?? 0) < COMMITS_TTL) return;
    try {
      const { owner, repo } = GROUP_REPO;
      const response = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`);
      if (!response.ok) return;
      const list = (await response.json()) as { login?: string; contributions?: number }[];
      const commits = Object.fromEntries(list.filter((item) => item.login).map((item) => [item.login!.toLowerCase(), item.contributions ?? 0]));
      localStorage.setItem(COMMITS_KEY, JSON.stringify({ at: Date.now(), commits }));
      set({ commits });
    } catch {
      // Без сети — остаётся прошлое число или «—»
    }
  },
}));
