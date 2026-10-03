import { Highlighter, Trash2 } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { findTextRange } from '../../lib/textRange';
import { useMarksStore } from './marksStore';
import styles from './NoteMarks.module.css';

const HIGHLIGHT = 'note-marks';
const supported = typeof CSS !== 'undefined' && 'highlights' in CSS;

/**
 * Подсветка пометок через CSS Custom Highlight API: разметку конспекта не трогаем (её строят Markdown и KaTeX),
 * браузер сам рисует фон под найденными диапазонами. Перерисовываем, когда текст конспекта догрузился.
 */
export function useMarkHighlights(contentRef: RefObject<HTMLElement | null>, noteId: string) {
  const marks = useMarksStore((state) => state.marks);
  useEffect(() => {
    const root = contentRef.current;
    if (!supported || !root) return undefined;
    const texts = marks.filter((mark) => mark.noteId === noteId).map((mark) => mark.text);
    const paint = () => {
      const ranges = texts.map((text) => findTextRange(root, text)).filter((range): range is Range => range !== null);
      CSS.highlights.set(HIGHLIGHT, new Highlight(...ranges));
    };
    let timer = 0;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(paint, 200);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    paint();
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      CSS.highlights.delete(HIGHLIGHT);
    };
  }, [contentRef, marks, noteId]);
}

/** Кнопка «Пометить» под выделенным в конспекте текстом */
export function MarkButton({ contentRef, noteId }: { contentRef: RefObject<HTMLElement | null>; noteId: string }) {
  const addMark = useMarksStore((state) => state.addMark);
  const [spot, setSpot] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    const onChange = () => {
      const selection = getSelection();
      const root = contentRef.current;
      const text = selection?.toString().trim() ?? '';
      if (!selection || selection.isCollapsed || !root || text.length < 3 || text.length > 600) return setSpot(null);
      const range = selection.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return setSpot(null);
      const rect = range.getBoundingClientRect();
      setSpot({ x: rect.left + rect.width / 2, y: rect.bottom + 8, text });
    };
    document.addEventListener('selectionchange', onChange);
    addEventListener('scroll', onChange, { passive: true });
    return () => {
      document.removeEventListener('selectionchange', onChange);
      removeEventListener('scroll', onChange);
    };
  }, [contentRef]);

  if (!spot) return null;
  return createPortal(
    <button
      type="button"
      className={styles.markButton}
      style={{ left: spot.x, top: spot.y }}
      // pointerdown, а не click: на телефоне выделение снимается раньше, чем дойдёт click
      onPointerDown={(event) => {
        event.preventDefault();
        addMark(noteId, spot.text);
        getSelection()?.removeAllRanges();
        setSpot(null);
      }}
    >
      <Highlighter size={14} strokeWidth={1.75} aria-hidden />
      Пометить
    </button>,
    document.body,
  );
}

/** Пометки конспекта в боковой панели: нажатие — к месту в тексте */
export function MarksList({ noteId, contentRef, onJump }: { noteId: string; contentRef: RefObject<HTMLElement | null>; onJump: () => void }) {
  const all = useMarksStore((state) => state.marks);
  const removeMark = useMarksStore((state) => state.removeMark);
  const marks = all.filter((mark) => mark.noteId === noteId);

  function jump(text: string) {
    const range = contentRef.current && findTextRange(contentRef.current, text);
    if (!range) return;
    scrollBy({ top: range.getBoundingClientRect().top - innerHeight / 3, behavior: 'smooth' });
    onJump();
  }

  if (!marks.length) return <p className={styles.empty}>Выделите текст в конспекте и нажмите «Пометить» — пометка появится здесь.</p>;
  return (
    <ul className={styles.list}>
      {marks.map((mark) => (
        <li key={mark.id} className={styles.item}>
          <button type="button" className={styles.text} onClick={() => jump(mark.text)}>
            {mark.text}
          </button>
          <button type="button" className={styles.remove} aria-label="Удалить пометку" onClick={() => removeMark(mark.id)}>
            <Trash2 size={13} strokeWidth={1.75} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
