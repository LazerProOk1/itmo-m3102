import type { Note } from '../../types/models';

export type NoteSort = 'updated' | 'title';

/** Ищет по названию и содержимому, без учёта регистра */
export function searchNotes(notes: Note[], query: string): Note[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return notes;

  return notes.filter(
    (note) => note.title.toLowerCase().includes(normalized) || note.content.toLowerCase().includes(normalized),
  );
}

export function sortNotes(notes: Note[], sort: NoteSort): Note[] {
  return [...notes].sort((a, b) =>
    sort === 'title' ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt),
  );
}
