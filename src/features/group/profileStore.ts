import { create } from 'zustand';
import { storageKey } from '../../lib/storage';
import { GROUP_REPO, githubFetch, rateLimitReset } from '../../services/github';

/** Данные GitHub для профиля — раз в час: лимит API без токена 60 запросов в час на всех */
const TTL = 60 * 60_000;
const COMMITS_KEY = storageKey('contributors');
const RECENT_KEY = storageKey('recent-commits');

export interface RecentCommit {
  /** Первая строка сообщения коммита */
  message: string;
  date: string;
  url: string;
}

interface Cached<T> {
  at: number;
  data: T;
}

interface ProfileStore {
  /** GitHub-логин открытого профиля */
  login: string | null;
  /** Профиль уже открывали — окно загружено и остаётся в DOM */
  used: boolean;
  /** Логин → коммитов в репозиторий группы; null — ещё не загружено или GitHub недоступен */
  commits: Record<string, number> | null;
  /** Логин → последние правки в репозитории группы (что добавил и когда) */
  recent: Record<string, Cached<RecentCommit[]>>;
  /** Почему не обновилось (лимит GitHub, нет сети) — мелкая приписка, сохранённое показывается */
  error: string;
  open: (login: string) => void;
  close: () => void;
}

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

/** Коротко, почему GitHub не ответил: это строка под списком, не плашка */
function failure(response?: Response): string {
  if (!response) return navigator.onLine ? 'GitHub не ответил' : 'нет интернета';
  const reset = rateLimitReset(response);
  if (reset) return `лимит запросов к GitHub, обновится в ${reset}`;
  return response.status === 403 || response.status === 429 ? 'лимит запросов к GitHub, попробуйте позже' : `GitHub ответил ${response.status}`;
}

/**
 * Профиль студента открывается из любого места (карточка на «Студентах», имя в очереди дедлайна) — окно одно,
 * в AppShell. Своё состояние, а не адрес: смена адреса перерисовывает всё приложение, и окно «застывало».
 */
export const useProfileStore = create<ProfileStore>()((set, get) => {
  async function loadCommits() {
    // Старый формат кеша ({ at, commits }) без data — скачать заново
    const cached = read<Cached<unknown>>(COMMITS_KEY);
    if (cached?.data && Date.now() - cached.at < TTL) return;
    const { owner, repo } = GROUP_REPO;
    const response = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`).catch(() => undefined);
    if (!response?.ok) return set({ error: failure(response) });
    const list = (await response.json()) as { login?: string; contributions?: number }[];
    const commits = Object.fromEntries(list.filter((item) => item.login).map((item) => [item.login!.toLowerCase(), item.contributions ?? 0]));
    localStorage.setItem(COMMITS_KEY, JSON.stringify({ at: Date.now(), data: commits }));
    set({ commits });
  }

  async function loadRecent(login: string) {
    const key = login.toLowerCase();
    if (Date.now() - (get().recent[key]?.at ?? 0) < TTL) return;
    const { owner, repo } = GROUP_REPO;
    const response = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/commits?author=${encodeURIComponent(login)}&per_page=5`).catch(
      () => undefined,
    );
    if (!response?.ok) return set({ error: failure(response) });
    const list = (await response.json()) as { html_url: string; commit: { message: string; author?: { date?: string } } }[];
    const data = list.map((item) => ({ message: item.commit.message.split('\n')[0]!, date: item.commit.author?.date ?? '', url: item.html_url }));
    const recent = { ...get().recent, [key]: { at: Date.now(), data } };
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    set({ recent });
  }

  return {
    login: null,
    used: false,
    commits: read<Cached<Record<string, number>>>(COMMITS_KEY)?.data ?? null,
    recent: read<Record<string, Cached<RecentCommit[]>>>(RECENT_KEY) ?? {},
    error: '',
    open: (login) => {
      set({ login, used: true, error: '' });
      void loadCommits();
      void loadRecent(login);
    },
    close: () => set({ login: null }),
  };
});
