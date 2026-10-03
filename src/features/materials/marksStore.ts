import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storageKey } from '../../lib/storage';

/** Пометка — сохранённый кусок текста конспекта; в тексте подсвечивается, в панели читалки — списком */
export interface NoteMark {
  id: string;
  noteId: string;
  text: string;
  at: string;
}

interface MarksStore {
  /** Закладки: id конспекта → когда добавлена */
  bookmarks: Record<string, string>;
  marks: NoteMark[];
  toggleBookmark: (noteId: string) => void;
  addMark: (noteId: string, text: string) => void;
  removeMark: (id: string) => void;
}

/** Личные закладки и пометки в конспектах — только в этом браузере */
export const useMarksStore = create<MarksStore>()(
  persist(
    (set) => ({
      bookmarks: {},
      marks: [],
      toggleBookmark: (noteId) =>
        set((state) => {
          const bookmarks = { ...state.bookmarks };
          if (bookmarks[noteId]) delete bookmarks[noteId];
          else bookmarks[noteId] = new Date().toISOString();
          return { bookmarks };
        }),
      addMark: (noteId, text) =>
        set((state) =>
          state.marks.some((mark) => mark.noteId === noteId && mark.text === text)
            ? state
            : { marks: [...state.marks, { id: crypto.randomUUID(), noteId, text, at: new Date().toISOString() }] },
        ),
      removeMark: (id) => set((state) => ({ marks: state.marks.filter((mark) => mark.id !== id) })),
    }),
    { name: storageKey('marks') },
  ),
);
