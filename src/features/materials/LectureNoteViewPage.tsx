import { ArrowLeft, Bookmark, BookmarkCheck, Download, ExternalLink, Pencil, Printer, Trash } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { ConfirmDeleteModal, useConfirmDelete } from '../../components/ui/ConfirmDeleteModal';
import { GithubSourceBadge } from '../../components/ui/GithubSourceBadge';
import { buttonClass } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { downloadUrl, saveBlob } from '../../lib/download';
import { findMovedPath, noteAssetBase, noteSourceUrl, rawUrl } from '../../services/githubContent';
import type { LectureNote } from '../../types/models';
import { useEditMode } from '../settings/EditModeContext';
import { useOptionalSubjectName } from '../subjects/subjectsStore';
import { LectureNoteContentView } from './LectureNoteContentView';
import { SiteQuiz } from './SiteQuiz';
import { useMarksStore } from './marksStore';
import { MarkButton, useMarkHighlights } from './NoteMarks';
import { LectureNoteDialog } from './LectureNoteDialog';
import { useLectureNoteDialog } from './useLectureNoteDialog';
import { useLectureNotesStore } from './lectureNotesStore';
import { NotePager, NoteSidebar, noteTitle, ReadingProgress, useSiblingNotes, useToc } from './NoteReader';
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
  const note = useLectureNotesStore((state) => state.lectureNotes.find((item) => item.id === noteId));
  const touchLectureNote = useLectureNotesStore((state) => state.touchLectureNote);

  useEffect(() => {
    // Наверх при открытии и возврат к месту по «Назад» — useScrollMemory в AppShell
    if (noteId) touchLectureNote(noteId);
  }, [noteId, touchLectureNote]);

  if (!note) return <MissingNote noteId={noteId} />;
  return <NoteView note={note} />;
}

/** Конспекта нет: возможно, файл переименовали в репозитории группы — ищем новый адрес, иначе в «Материалы» */
function MissingNote({ noteId }: { noteId: string }) {
  const [target, setTarget] = useState<string | null>(null);
  const notes = useLectureNotesStore((state) => state.lectureNotes);

  useEffect(() => {
    if (!noteId.startsWith('gh:')) {
      setTarget(SECTIONS.materials.path);
      return;
    }
    let active = true;
    void findMovedPath(noteId.slice(3)).then((moved) => {
      if (!active) return;
      const found = moved && notes.find((item) => item.id === `gh:${moved}`);
      setTarget(found ? `/materials/notes/${found.id}` : SECTIONS.materials.path);
    });
    return () => {
      active = false;
    };
  }, [noteId, notes]);

  return target ? <Navigate to={target} replace /> : null;
}

/** Читалка: текст конспекта, справа «Лекции» предмета и «Содержание», сверху — прогресс чтения */
function NoteView({ note }: { note: LectureNote }) {
  const navigate = useNavigate();
  const { isEditMode } = useEditMode();
  const deleteLectureNote = useLectureNotesStore((state) => state.deleteLectureNote);
  const subjectName = useOptionalSubjectName(note?.subjectId);
  const dialog = useLectureNoteDialog();
  const confirmDelete = useConfirmDelete<LectureNote>();
  const articleRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const siblings = useSiblingNotes(note);
  const toc = useToc(contentRef, note.id + note.updatedAt);
  const bookmarked = useMarksStore((state) => Boolean(state.bookmarks[note.id]));
  const toggleBookmark = useMarksStore((state) => state.toggleBookmark);
  useMarkHighlights(contentRef, note.id);

  const title = noteTitle(note);
  const sourceUrl = noteSourceUrl(note);

  return (
    <div className={styles.layout}>
      <ReadingProgress targetRef={articleRef} />
      <article ref={articleRef} className={styles.page}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => navigate(-1)}>
            <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
            Назад
          </button>

          <div className={styles.titleRow}>
            <div>
              <h1 className={styles.title} data-morph-target>
                {title}
                {note.source === 'github' && <GithubSourceBadge />}
              </h1>
              {subjectName && <p className={styles.subtitle}>{subjectName}</p>}
            </div>

            <div className={styles.actions}>
              <IconButton
                icon={bookmarked ? BookmarkCheck : Bookmark}
                label={bookmarked ? 'Убрать из закладок' : 'В закладки'}
                aria-pressed={bookmarked}
                onClick={() => toggleBookmark(note.id)}
              />
              {note.contentType !== 'link' && (
                <IconButton
                  icon={Download}
                  label={note.contentType === 'pdf' ? 'Скачать PDF' : 'Скачать .md'}
                  onClick={() => void downloadNote(note, title)}
                />
              )}
              {note.contentType === 'markdown' && <IconButton icon={Printer} label="Печать / сохранить как PDF" onClick={() => window.print()} />}
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

        <div ref={contentRef} className={styles.content}>
          <LectureNoteContentView contentType={note.contentType} content={note.content} sourceRef={note.sourceRef} baseUrl={noteAssetBase(note)} />
          {/* Свой тест — только к конспектам группы и только если в конспекте нет теста от самой группы */}
          {note.source === 'github' && (note.collection ?? 'group') === 'group' && !note.content.includes('```quiz') && (
            <SiteQuiz sourceRef={note.sourceRef} />
          )}
        </div>
        <NotePager note={note} siblings={siblings} />
      </article>

      <NoteSidebar note={note} siblings={siblings} toc={toc} contentRef={contentRef} />
      {note.contentType === 'markdown' && <MarkButton contentRef={contentRef} noteId={note.id} />}

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

/** Оригинальный файл конспекта: из GitHub — как лежит в репозитории, свой — из сохранённого текста */
async function downloadNote(note: LectureNote, title: string) {
  const ext = note.contentType === 'pdf' ? 'pdf' : 'md';
  const name = note.sourceRef?.split('/').pop() ?? `${title.replace(/[\\/:*?"<>|]/g, '_')}.${ext}`;
  if (note.source === 'github' && note.sourceRef) {
    const url = rawUrl(note.collection ?? 'group', note.sourceRef);
    return downloadUrl(url, name).catch(() => window.open(url, '_blank', 'noopener'));
  }
  if (ext === 'md') return saveBlob(new Blob([note.content], { type: 'text/markdown;charset=utf-8' }), name);
  return downloadUrl(note.content, name).catch(() => window.open(note.content, '_blank', 'noopener'));
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
