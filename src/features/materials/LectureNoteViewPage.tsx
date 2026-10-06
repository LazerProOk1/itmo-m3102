import { ArrowLeft, Bookmark, BookmarkCheck, Download, ExternalLink, FileDown, LoaderCircle, Pencil, Printer, Trash } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { SECTIONS } from '../../app/navigation';
import { ConfirmDeleteModal, useConfirmDelete } from '../../components/ui/ConfirmDeleteModal';
import { GithubSourceBadge } from '../../components/ui/GithubSourceBadge';
import { buttonClass } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { downloadUrl, saveBlob } from '../../lib/download';
import { findMovedPath, noteAssetBase, noteSourceUrl, rawUrl } from '../../services/githubContent';
import { useSyncStore } from '../../services/syncStore';
import type { LectureNote } from '../../types/models';
import { useEditMode } from '../settings/EditModeContext';
import { useOptionalSubjectName } from '../subjects/subjectsStore';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { LectureNoteContentView } from './LectureNoteContentView';
import { NoteLessonInfo } from './NoteLessonInfo';
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

  // Пока читают — без фона-сияния (aurora.css), он отвлекает от текста
  useEffect(() => {
    document.documentElement.dataset.reading = '';
    return () => {
      delete document.documentElement.dataset.reading;
    };
  }, []);

  useEffect(() => {
    // Наверх при открытии и возврат к месту по «Назад» — useScrollMemory в AppShell
    if (noteId) touchLectureNote(noteId);
  }, [noteId, touchLectureNote]);

  if (!note) return <MissingNote noteId={noteId} />;
  // key: у каждого конспекта своё состояние — новый открывается со скелета, а не с текста предыдущего
  return <NoteView key={note.id} note={note} />;
}

/** Конспекта нет: возможно, файл переименовали в репозитории группы — ищем новый адрес, иначе в «Материалы» */
function MissingNote({ noteId }: { noteId: string }) {
  const [target, setTarget] = useState<string | null>(null);
  const notes = useLectureNotesStore((state) => state.lectureNotes);
  // Первый заход на сайт по ссылке на конспект: конспекты ещё качаются — ждём, а не уводим в «Материалы»
  const syncing = useSyncStore((state) => state.status === 'syncing' || state.status === 'idle');

  useEffect(() => {
    if (syncing) return;
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
  }, [noteId, notes, syncing]);

  return target ? <Navigate to={target} replace /> : null;
}

/** Читалка: текст конспекта, справа «Лекции» предмета и «Содержание», сверху — прогресс чтения */
function NoteView({ note }: { note: LectureNote }) {
  // Большой конспект (100 КБ, сотни формул) разбирается сотни миллисекунд, на телефоне — секунды. Сначала
  // кадр с шапкой и скелетом, затем текст одним проходом. Не useDeferredValue: фоновую отрисовку прерывает
  // любое обновление (оглавление, «последний раз открыт»), и разбор начинается заново — выходило дольше
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const show = () => setReady(true);
    const frame = requestAnimationFrame(() => setTimeout(show));
    const fallback = setTimeout(show, 120); // вкладка в фоне: кадров нет
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(fallback);
    };
  }, []);
  const content = ready ? note.content : '';
  const navigate = useNavigate();
  const { isEditMode } = useEditMode();
  const deleteLectureNote = useLectureNotesStore((state) => state.deleteLectureNote);
  const subjectName = useOptionalSubjectName(note?.subjectId);
  const dialog = useLectureNoteDialog();
  const confirmDelete = useConfirmDelete<LectureNote>();
  const articleRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const siblings = useSiblingNotes(note);
  // Оглавление — когда текст уже отрисован (см. content ниже)
  const toc = useToc(contentRef, note.id + note.updatedAt + (content ? ':ready' : ''));
  const bookmarked = useMarksStore((state) => Boolean(state.bookmarks[note.id]));
  const toggleBookmark = useMarksStore((state) => state.toggleBookmark);
  useMarkHighlights(contentRef, note.id);

  const title = noteTitle(note);
  useDocumentTitle(title, note.id);
  const sourceUrl = noteSourceUrl(note);
  // «Скачать PDF» сразу файлом: модуль со съёмкой страниц грузится только по нажатию
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  async function downloadPdf() {
    if (pdfStatus || !contentRef.current) return;
    setPdfStatus('Готовлю…');
    try {
      const { downloadNotePdf } = await import('./notePdf');
      await downloadNotePdf(contentRef.current, title, [subjectName, note.lectureNumber].filter(Boolean).join(' · '), setPdfStatus);
    } catch (error) {
      console.error(error);
      alert('Не получилось собрать PDF. Попробуйте «Печать → Сохранить как PDF».');
    } finally {
      setPdfStatus(null);
    }
  }

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
              <NoteLessonInfo note={note} subjectName={subjectName} />
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
              {note.contentType === 'markdown' && (
                <>
                  <IconButton
                    icon={pdfStatus ? LoaderCircle : FileDown}
                    label={pdfStatus ? `PDF: ${pdfStatus}` : 'Скачать PDF'}
                    className={pdfStatus ? styles.spinning : undefined}
                    aria-busy={Boolean(pdfStatus)}
                    onClick={() => void downloadPdf()}
                  />
                  <IconButton icon={Printer} label="Печать (PDF с выделяемым текстом)" onClick={() => window.print()} />
                </>
              )}
              {/* PDF печатает сам браузер из своего просмотрщика — постранично, без обрезки и без интерфейса сайта */}
              {note.contentType === 'pdf' && !note.content.startsWith('data:') && (
                <IconButton icon={Printer} label="Открыть PDF для печати" onClick={() => window.open(note.content, '_blank', 'noopener')} />
              )}
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
          {content || !note.content ? (
            <LectureNoteContentView contentType={note.contentType} content={content} sourceRef={note.sourceRef} baseUrl={noteAssetBase(note)} />
          ) : (
            <NoteBodySkeleton />
          )}
          {/* Свой тест — только к конспектам группы и только если в конспекте нет теста от самой группы */}
          {note.source === 'github' && !note.content.includes('```quiz') && <SiteQuiz sourceRef={note.sourceRef} />}
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
    const url = rawUrl('group', note.sourceRef);
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

/** Строки-заглушки на месте текста, пока он отрисовывается */
function NoteBodySkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label="Конспект загружается">
      {[92, 100, 78, 96, 64, 88, 100, 70].map((width, index) => (
        <span key={index} style={{ width: `${width}%` }} />
      ))}
    </div>
  );
}
