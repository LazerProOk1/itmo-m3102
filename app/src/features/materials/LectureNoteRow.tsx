import { Ellipsis, Pencil, Trash } from 'lucide-react';
import { Link } from 'react-router';
import { ConfirmDeleteModal, useConfirmDelete } from '../../components/ui/ConfirmDeleteModal';
import { DropdownItem, DropdownMenu, DropdownSeparator } from '../../components/ui/DropdownMenu';
import { GithubSourceBadge } from '../../components/ui/GithubSourceBadge';
import { IconButton } from '../../components/ui/IconButton';
import { ListItem } from '../../components/ui/List';
import { formatDayLabel } from '../../lib/dates';
import type { ISODate, LectureNote } from '../../types/models';
import { useEditMode } from '../settings/EditModeContext';
import { useOptionalSubjectName } from '../subjects/subjectsStore';
import { LECTURE_NOTE_CONTENT_ICONS } from './labels';
import { useLectureNotesStore } from './lectureNotesStore';
import styles from './LectureNoteRow.module.css';
import { noteTitle } from './NoteReader';

interface LectureNoteRowProps {
  note: LectureNote;
  today: ISODate;
  /** Открывает окно редактирования полей (предмет/номер/тип) — сам текст читают на отдельной странице */
  onEdit: (note: LectureNote) => void;
  /** Показать предмет в подписи — нужно там, где конспекты разных предметов вперемешку */
  showSubject?: boolean;
}

/** Строка конспекта: номер лекции + название (клик — отдельная страница чтения), дата добавления, меню. */
export function LectureNoteRow({ note, today, onEdit, showSubject = false }: LectureNoteRowProps) {
  const { isEditMode } = useEditMode();
  const deleteLectureNote = useLectureNotesStore((state) => state.deleteLectureNote);
  const subjectName = useOptionalSubjectName(note.subjectId);
  const title = noteTitle(note);
  const confirmDelete = useConfirmDelete<LectureNote>();
  const ContentIcon = LECTURE_NOTE_CONTENT_ICONS[note.contentType];

  return (
    <>
      <ListItem
        leading={
          <span className={styles.icon}>
            <ContentIcon size={14} strokeWidth={1.75} aria-hidden />
          </span>
        }
        title={
          <Link to={`/materials/notes/${note.id}`} className={styles.titleButton} data-morph>
            {title}
            {note.source === 'github' && <GithubSourceBadge />}
          </Link>
        }
        meta={showSubject ? subjectName : undefined}
        trailing={
          <>
            <span className={styles.date}>{formatDayLabel(note.createdAt.slice(0, 10), today)}</span>
            {isEditMode && (
              <span className={styles.menu}>
                <DropdownMenu align="end" trigger={(props) => <IconButton icon={Ellipsis} label="Действия с конспектом" size="sm" {...props} />}>
                  <DropdownItem icon={Pencil} onSelect={() => onEdit(note)}>
                    Изменить
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem icon={Trash} onSelect={() => confirmDelete.request(note)}>
                    Удалить
                  </DropdownItem>
                </DropdownMenu>
              </span>
            )}
          </>
        }
      />
      <ConfirmDeleteModal
        open={confirmDelete.target !== null}
        title={confirmDelete.target ? title : ''}
        onCancel={confirmDelete.cancel}
        onConfirm={() => {
          if (confirmDelete.target) deleteLectureNote(confirmDelete.target.id);
          confirmDelete.cancel();
        }}
      />
    </>
  );
}
