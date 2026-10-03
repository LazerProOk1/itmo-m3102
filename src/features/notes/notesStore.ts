import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createEntity, replaceEntity } from '../../lib/entity';
import { localStore, storageKey } from '../../lib/storage';
import type { ID, Note } from '../../types/models';

export interface NoteDraft {
  title: string;
  subjectId?: string;
  content: string;
}

interface NotesStore {
  notes: Note[];
  addNote: (draft: NoteDraft) => void;
  updateNote: (id: ID, draft: NoteDraft) => void;
  deleteNote: (id: ID) => void;
}

export const useNotesStore = create<NotesStore>()(
  persist(
    (set) => ({
      notes: [],
      addNote: (draft) => set((state) => ({ notes: [createEntity(draft), ...state.notes] })),
      updateNote: (id, draft) => set((state) => ({ notes: state.notes.map((note) => (note.id === id ? replaceEntity(note, draft) : note)) })),
      deleteNote: (id) => set((state) => ({ notes: state.notes.filter((note) => note.id !== id) })),
    }),
    { name: storageKey('notes'), storage: localStore },
  ),
);
