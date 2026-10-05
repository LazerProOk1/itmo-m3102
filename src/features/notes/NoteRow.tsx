import { Ellipsis, NotebookPen, Pencil, Trash } from 'lucide-react';
import { ConfirmDeleteModal, useConfirmDelete } from '../../components/ui/ConfirmDeleteModal';
import { DropdownItem, DropdownMenu, DropdownSeparator } from '../../components/ui/DropdownMenu';
import { IconButton } from '../../components/ui/IconButton';
import { ListItem } from '../../components/ui/List';
import { formatDayLabel } from '../../lib/dates';
import type { ISODate, Note } from '../../types/models';
import { useOptionalSubjectName } from '../subjects/subjectsStore';
import { useNotesStore } from './notesStore';
import styles from './NoteRow.module.css';

interface NoteRowProps {
  note: Note;
  today: ISODate;
  onEdit: (note: Note) => void;
  /** Показать предмет в подписи — нужно там, где заметки разных предметов вперемешку */
  showSubject?: boolean;
}

/** Первая непустая строка содержимого — короткий превью заметки в списке */
function firstLine(content: string): string | undefined {
  return content
    .split('\n')
    .find((line) => line.trim())
    ?.trim();
}

/** Строка заметки: заголовок (клик — редактирование), превью содержимого, дата изменения, меню. */
export function NoteRow({ note, today, onEdit, showSubject = false }: NoteRowProps) {
  const deleteNote = useNotesStore((state) => state.deleteNote);
  const subjectName = useOptionalSubjectName(note.subjectId);
  const confirmDelete = useConfirmDelete<Note>();

  const preview = firstLine(note.content);
  const meta = showSubject ? [subjectName, preview].filter(Boolean).join(' · ') : (preview ?? 'Пока нет текста');

  return (
    <>
      <ListItem
        leading={
          <span className={styles.icon}>
            <NotebookPen size={14} strokeWidth={1.75} aria-hidden />
          </span>
        }
        title={
          <button type="button" className={styles.titleButton} onClick={() => onEdit(note)} data-row-action>
            {note.title}
          </button>
        }
        meta={meta}
        trailing={
          <>
            <span className={styles.date}>{formatDayLabel(note.updatedAt.slice(0, 10), today)}</span>
            <DropdownMenu align="end" trigger={(props) => <IconButton icon={Ellipsis} label="Действия с заметкой" size="sm" {...props} />}>
              <DropdownItem icon={Pencil} onSelect={() => onEdit(note)}>
                Изменить
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem icon={Trash} onSelect={() => confirmDelete.request(note)}>
                Удалить
              </DropdownItem>
            </DropdownMenu>
          </>
        }
      />
      <ConfirmDeleteModal
        open={confirmDelete.target !== null}
        title={confirmDelete.target?.title ?? ''}
        onCancel={confirmDelete.cancel}
        onConfirm={() => {
          if (confirmDelete.target) deleteNote(confirmDelete.target.id);
          confirmDelete.cancel();
        }}
      />
    </>
  );
}
