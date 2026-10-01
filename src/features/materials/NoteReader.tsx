import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, List as ListIcon, Search, X } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';
import { Link } from 'react-router';
import { Input } from '../../components/ui/Input';
import { cn } from '../../lib/cn';
import { SPRING_SNAPPY } from '../../lib/motion';
import type { LectureNote } from '../../types/models';
import { useLectureNotesStore } from './lectureNotesStore';
import styles from './NoteReader.module.css';

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

const firstNumber = (value: string) => Number(/\d+/.exec(value)?.[0] ?? Infinity);

/**
 * Порядок как на сайте группы: по номеру занятия (Лекция 1, Практика 1, Лекция 2…), занятия без
 * номера («Доп материалы») — в конце; внутри занятия сначала текстовые конспекты, потом PDF и файлы.
 */
export function compareLessons(a: LectureNote, b: LectureNote): number {
  return (
    firstNumber(a.lectureNumber) - firstNumber(b.lectureNumber) ||
    a.lectureNumber.localeCompare(b.lectureNumber, 'ru', { numeric: true }) ||
    Number(a.contentType !== 'markdown') - Number(b.contentType !== 'markdown') ||
    a.title.localeCompare(b.title, 'ru')
  );
}

/** Конспекты того же предмета и той же папки, по порядку занятий — для навигации и «пред./след.» */
export function useSiblingNotes(note: LectureNote): LectureNote[] {
  const notes = useLectureNotesStore((state) => state.lectureNotes);
  return notes
    .filter((item) => !item.archived && item.subjectId === note.subjectId && (item.collection ?? 'group') === (note.collection ?? 'group'))
    .sort(compareLessons);
}

/**
 * Заголовки h2/h3 отрисованного конспекта + какой из них сейчас читается. Берём из DOM, а не из
 * markdown: так текст совпадает с тем, что видно (формулы, жирный), а id ставим сами.
 */
export function useToc(containerRef: RefObject<HTMLElement | null>, contentKey: string): { items: TocItem[]; activeId: string } {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const headings = [...container.querySelectorAll<HTMLHeadingElement>('h2, h3')];
    headings.forEach((heading, index) => {
      if (!heading.id) heading.id = `toc-${index}`;
    });
    setItems(headings.map((heading) => ({ id: heading.id, text: heading.textContent?.trim() ?? '', level: heading.tagName === 'H2' ? 2 : 3 })));
    setActiveId(headings[0]?.id ?? '');

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-72px 0px -65% 0px' },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [containerRef, contentKey]);

  return { items, activeId };
}

/** Тонкая полоса вверху — сколько конспекта уже прочитано */
export function ReadingProgress({ targetRef }: { targetRef: RefObject<HTMLElement | null> }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const target = targetRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      setProgress(total <= 0 ? 1 : Math.min(1, Math.max(0, -rect.top / total)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [targetRef]);

  return (
    <div className={styles.progress} aria-hidden>
      <span style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}

type SidebarTab = 'lectures' | 'toc';

interface NoteSidebarProps {
  note: LectureNote;
  siblings: LectureNote[];
  toc: { items: TocItem[]; activeId: string };
}

/** Боковая панель читалки, как на сайте группы: «Лекции» предмета и «Содержание» с текущим разделом */
export function NoteSidebar({ note, siblings, toc }: NoteSidebarProps) {
  const [chosenTab, setTab] = useState<SidebarTab | null>(null);
  // Пока пользователь сам не выбрал вкладку: есть разделы — «Содержание», нет — «Лекции»
  const tab = chosenTab ?? (toc.items.length > 1 ? 'toc' : 'lectures');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => setOpen(false), [note.id]);

  const q = query.trim().toLowerCase().replace(/ё/g, 'е');
  const filtered = siblings.filter((item) => `${item.lectureNumber} ${item.title}`.toLowerCase().replace(/ё/g, 'е').includes(q));
  const groups = new Map<string, LectureNote[]>();
  for (const item of filtered) groups.set(item.lectureNumber, [...(groups.get(item.lectureNumber) ?? []), item]);

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setOpen(false);
  }

  return (
    <>
      <button type="button" className={styles.fab} aria-label="Навигация по конспекту" aria-expanded={open} onClick={() => setOpen(true)}>
        <ListIcon size={20} strokeWidth={1.75} aria-hidden />
      </button>
      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} />}

      <aside className={cn(styles.side, open && styles.open)} aria-label="Навигация по конспекту">
        <div className={styles.tabs} role="tablist">
          {(['lectures', 'toc'] as const).map((value) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} className={styles.tab} onClick={() => setTab(value)}>
              {tab === value && <motion.span layoutId="note-side-tab" className={styles.tabInk} transition={SPRING_SNAPPY} />}
              <span>{value === 'lectures' ? 'Лекции' : 'Содержание'}</span>
            </button>
          ))}
          <button type="button" className={styles.close} aria-label="Закрыть" onClick={() => setOpen(false)}>
            <X size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        {tab === 'lectures' ? (
          <div className={styles.section}>
            <Input icon={Search} type="search" placeholder="Поиск в предмете" aria-label="Поиск в предмете" value={query} onChange={(event) => setQuery(event.target.value)} />
            {[...groups].map(([lesson, items]) => (
              <div key={lesson} className={styles.lesson}>
                <p className={styles.lessonName}>{lesson}</p>
                {items.map((item) => (
                  <Link key={item.id} to={`/materials/notes/${item.id}`} className={cn(styles.lectureLink, item.id === note.id && styles.current)}>
                    {item.title}
                  </Link>
                ))}
              </div>
            ))}
            {groups.size === 0 && <p className={styles.empty}>Ничего не найдено</p>}
          </div>
        ) : (
          <nav className={styles.section} aria-label="Содержание">
            {toc.items.length === 0 && <p className={styles.empty}>В этом конспекте нет разделов</p>}
            {toc.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(styles.tocItem, item.level === 3 && styles.tocSub, item.id === toc.activeId && styles.tocActive)}
                onClick={() => jump(item.id)}
              >
                {item.id === toc.activeId && <motion.span layoutId="note-toc-ink" className={styles.tocInk} transition={SPRING_SNAPPY} />}
                {item.text}
              </button>
            ))}
          </nav>
        )}
      </aside>
    </>
  );
}

/** «← Предыдущий / Следующий →» в конце конспекта */
export function NotePager({ note, siblings }: { note: LectureNote; siblings: LectureNote[] }) {
  const index = siblings.findIndex((item) => item.id === note.id);
  const previous = index > 0 ? siblings[index - 1] : undefined;
  const next = index >= 0 ? siblings[index + 1] : undefined;
  if (!previous && !next) return null;

  return (
    <nav className={styles.pager} aria-label="Соседние конспекты">
      {previous ? (
        <Link to={`/materials/notes/${previous.id}`} className={styles.pagerLink}>
          <small>
            <ArrowLeft size={12} strokeWidth={2} aria-hidden /> {previous.lectureNumber}
          </small>
          <span>{previous.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link to={`/materials/notes/${next.id}`} className={cn(styles.pagerLink, styles.pagerNext)}>
          <small>
            {next.lectureNumber} <ArrowRight size={12} strokeWidth={2} aria-hidden />
          </small>
          <span>{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
