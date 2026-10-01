import { NotebookPen } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { List } from '../../components/ui/List';
import { pluralize } from '../../lib/pluralize';
import type { ISODate, Note } from '../../types/models';
import { NoteRow } from '../notes/NoteRow';
import { TabToolbar } from './TabToolbar';

interface SubjectNotesTabProps {
  notes: Note[];
  today: ISODate;
  onAdd: () => void;
  onEdit: (note: Note) => void;
}

/** Заметки предмета, последние изменённые — сверху. */
export function SubjectNotesTab({ notes, today, onAdd, onEdit }: SubjectNotesTabProps) {
  const sorted = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <>
      <TabToolbar label={pluralize(notes.length, ['заметка', 'заметки', 'заметок'])} addLabel="Добавить заметку" onAdd={onAdd} personal />
      {sorted.length === 0 ? (
        <EmptyState icon={NotebookPen} title="Пока нет заметок" description="Храните здесь всё, что стоит запомнить." />
      ) : (
        <List>
          {sorted.map((note) => (
            <NoteRow key={note.id} note={note} today={today} onEdit={onEdit} />
          ))}
        </List>
      )}
    </>
  );
}
