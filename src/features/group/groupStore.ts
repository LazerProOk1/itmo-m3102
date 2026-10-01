import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storageKey } from '../../lib/storage';

/** Дедлайн из Дедлайны/deadlines.json репозитория группы */
export interface GroupDeadline {
  id: string;
  name: string;
  /** "2026-10-02T23:59:00+03:00" */
  deadline: string;
  note?: string;
}

/** Файл репозитория группы — для браузера файлов (как вкладка «Материалы» на сайте M3102) */
export interface RepoFile {
  path: string;
  size: number;
}

interface GroupStore {
  deadlines: GroupDeadline[];
  /** Личные отметки «выполнено» — видны только в этом браузере */
  deadlinesDone: Record<string, boolean>;
  files: RepoFile[];
  toggleDeadlineDone: (id: string, done: boolean) => void;
}

export const useGroupStore = create<GroupStore>()(
  persist(
    (set) => ({
      deadlines: [],
      deadlinesDone: {},
      files: [],
      toggleDeadlineDone: (id, done) => set((state) => ({ deadlinesDone: { ...state.deadlinesDone, [id]: done } })),
    }),
    { name: storageKey('group') },
  ),
);

export function parseDeadlines(raw: unknown): GroupDeadline[] {
  if (!Array.isArray(raw)) throw new Error('Неверный формат deadlines.json');
  return raw
    .filter((item): item is GroupDeadline => Boolean(item?.id && item?.name && Number.isFinite(new Date(item.deadline).getTime())))
    .map(({ id, name, deadline, note }) => ({ id: String(id), name: String(name), deadline: String(deadline), note: note ? String(note) : undefined }))
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
}

/** Файлы и папки сайта, которые не относятся к материалам — как isHiddenPath на сайте M3102 */
const HIDDEN_FILES = ['site.css', 'package.json', 'readme.md', '.gitignore', 'index.html'];
const HIDDEN_FOLDERS = ['tests', 'inner', 'data', 'js', 'css', 'docs', 'img', '.github', 'дедлайны'];

export function isHiddenPath(path: string): boolean {
  const parts = path.split('/');
  return HIDDEN_FILES.includes(parts[parts.length - 1]!.toLowerCase()) || parts.some((part) => HIDDEN_FOLDERS.includes(part.toLowerCase()));
}
