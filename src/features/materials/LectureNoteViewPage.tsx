import { ArrowLeft, ExternalLink, Pencil, Printer, Trash } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { ConfirmDeleteModal, useConfirmDelete } from '../../components/ui/ConfirmDeleteModal';
import { GithubSourceBadge } from '../../components/ui/GithubSourceBadge';
import { buttonClass } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { noteSourceUrl } from '../../services/githubContent';
import type { LectureNote } from '../../types/models';
import { useEditMode } from '../settings/EditModeContext';
import { useOptionalSubjectName } from '../subjects/subjectsStore';
import { LectureNoteContentView } from './LectureNoteContentView';
import { LectureNoteDialog } from './LectureNoteDialog';
import { useLectureNoteDialog } from './useLectureNoteDialog';
import { useLectureNotesStore } from './lectureNotesStore';
import styles from './LectureNoteViewPage.module.css';

/**
 * Отдельная страница для чтения конспекта — раньше открывался в модалке рядом с
 * отключёнными полями формы (предмет/название), из-за чего сам текст оставался в
 * узкой колонке. Здесь у конспекта вся ширина страницы и увеличенный кегль для чтения.
 * Редактирование полей (предмет/номер/тип) по-прежнему через LectureNoteDialog.
 */
export function LectureNoteViewPage() {
  // id конспекта из GitHub — "gh:Конспекты/…/файл.md", со слешами, поэтому маршрут "notes/*"
  const splat = useParams()['*'] ?? '';
  const noteId = safeDecodeURIComponent(splat);
  const navigate = useNavigate();
  const { isEditMode } = useEditMode();
  const note = useLectureNotesStore((state) => state.lectureNotes.find((item) => item.id === noteId));
  const touchLectureNote = useLectureNotesStore((state) => state.touchLectureNote);
  const deleteLectureNote = useLectureNotesStore((state) => state.deleteLectureNote);
  const subjectName = useOptionalSubjectName(note?.subjectId);
  const dialog = useLectureNoteDialog();
  const confirmDelete = useConfirmDelete<LectureNote>();

  useEffect(() => {
    if (noteId) touchLectureNote(noteId);
  }, [noteId, touchLectureNote]);

  if (!note) return <Navigate to={SECTIONS.materials.path} replace />;

  const title = note.lectureNumber ? `${note.lectureNumber}. ${note.title}` : note.title;
  const sourceUrl = noteSourceUrl(note);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
          Назад
        </button>

        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>
              {title}
              {note.source === 'github' && <GithubSourceBadge />}
            </h1>
            {subjectName && <p className={styles.subtitle}>{subjectName}</p>}
          </div>

          <div className={styles.actions}>
            {note.contentType === 'markdown' && <IconButton icon={Printer} label="Скачать PDF" onClick={() => window.print()} />}
            {sourceUrl && (
              <a className={buttonClass('ghost', 'sm')} href={sourceUrl} target="_blank" rel="noopener noreferrer" title="Оригинал на GitHub">
                <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
                GitHub
              </a>
            )}
            {isEditMode && (
              <>
                <IconButton icon={Pencil} label="Изменить" onClick={() => dialog.openEdit(note)} />
                <IconButton icon={Trash} label="Удалить" onClick={() => confirmDelete.request(note)} />
              </>
            )}
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <LectureNoteContentView contentType={note.contentType} content={note.content} sourceRef={note.sourceRef} />
      </div>

      <LectureNoteDialog target={dialog.target} onClose={dialog.close} />
      <ConfirmDeleteModal
        open={confirmDelete.target !== null}
        title={confirmDelete.target ? title : ''}
        onCancel={confirmDelete.cancel}
        onConfirm={() => {
          if (confirmDelete.target) {
            deleteLectureNote(confirmDelete.target.id);
            navigate(SECTIONS.materials.path);
          }
          confirmDelete.cancel();
        }}
      />
    </div>
  );
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
