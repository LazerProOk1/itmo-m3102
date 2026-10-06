import { BookmarkCheck, ChevronDown, ChevronUp, ExternalLink, Maximize2, Minus, Moon, Plus, Sun } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { pdfjs } from 'react-pdf';
import { IconButton } from '../../components/ui/IconButton';
import { cn } from '../../lib/cn';
import { storageKey } from '../../lib/storage';
import { useSettingsStore } from '../settings/settingsStore';
import styles from './PdfViewer.module.css';

/** Адрес воркера pdf.js — «Работа без интернета» скачивает его заранее */
export const PDF_WORKER_URL = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

/** Короткое описание ошибки pdf.js и версия браузера — для сообщения «Не удалось показать PDF» */
function describeError(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Ошибка';
  const message = error instanceof Error ? error.message : String(error);
  const browser = /(Chrome|Firefox|Version|Edg)\/[\d.]+/.exec(navigator.userAgent)?.[0] ?? 'браузер неизвестен';
  return `${name}: ${message}`.slice(0, 160) + ` · ${browser}`;
}

type PdfDocument = Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;

interface PdfViewerProps {
  /** data: URI (загружен локально) или ссылка на файл */
  file: string;
}

const ZOOM_STEPS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2];
/** Ширина «по ширине» — как у читалки на сайте группы */
const MAX_WIDTH = 900;
/** Страницы рисуются заранее, когда до них осталось столько пикселей прокрутки */
const PRELOAD_MARGIN = '1600px 0px';
/** Чёткость холста: выше 2× разница не видна, а память растёт квадратично */
const MAX_PIXEL_RATIO = 2;
// ponytail: держим отрисованными последние N страниц, самые давние стираются — иначе учебник на сотни
// страниц съест память и браузер перезагрузит вкладку. Обычный конспект (< N страниц) не стирается никогда.
const MAX_DRAWN_PAGES = 40;

/** Где остановился в каждом PDF: { файл: страница }, последние 100 файлов */
const PAGES_KEY = storageKey('pdf-pages');
const MAX_REMEMBERED = 100;

function readPages(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(PAGES_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

export function savedPage(file: string): number {
  return readPages()[file] ?? 0;
}

export function savePage(file: string, page: number) {
  const pages = readPages();
  delete pages[file]; // свежий — в конец, старые вытесняются первыми
  if (page > 1) pages[file] = page;
  const entries = Object.entries(pages).slice(-MAX_REMEMBERED);
  try {
    localStorage.setItem(PAGES_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Приватный режим или нет места — просто не запомним
  }
}

/**
 * PDF целиком, сплошной лентой — как на сайте группы: каждая страница — свой <canvas>, который
 * создаётся один раз и рисуется при приближении к экрану. Холсты живут вне React, поэтому
 * перерисовки страницы (счётчик страниц, прогресс чтения, синхронизация) их не сбрасывают.
 * Размер каждой страницы задаётся сразу — прокрутка не прыгает.
 */
export function PdfViewer({ file }: PdfViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [baseWidth, setBaseWidth] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(ZOOM_STEPS.indexOf(1));
  const [current, setCurrent] = useState(1);
  /** Почему не открылся (текст ошибки pdf.js) — показываем под сообщением, чтобы по скриншоту было видно причину */
  const [failed, setFailed] = useState<string | null>(null);
  const dark = useSettingsStore((state) => state.pdfDark);
  const setAppearance = useSettingsStore((state) => state.setAppearance);
  // Страница, на которой остановился в прошлый раз: кнопка «Продолжить» в панели, пока туда не дошёл
  const [resume, setResume] = useState(() => savedPage(file));

  useEffect(() => {
    // Пока не дошёл до прошлого места (или не нажал «Продолжить»), прошлое место не перезаписываем
    if (!pdf || (resume && current < resume - 1)) return;
    setResume(0);
    savePage(file, current);
  }, [pdf, file, current, resume]);

  // Ширина меряется один раз; мелкие изменения (появилась полоса прокрутки) не перерисовывают PDF
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => Math.min(MAX_WIDTH, Math.floor(root.getBoundingClientRect().width));
    setBaseWidth(measure());
    const observer = new ResizeObserver(() => setBaseWidth((old) => (Math.abs(measure() - old) > 40 ? measure() : old)));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    const task = pdfjs.getDocument({ url: file });
    // destroy() при уходе со страницы тоже отклоняет promise — это не ошибка файла
    task.promise.then(
      (doc) => active && setPdf(doc),
      (error: unknown) => {
        if (!active) return;
        console.warn('PDF не открылся:', error);
        setFailed(describeError(error));
      },
    );
    return () => {
      active = false;
      void task.destroy();
    };
  }, [file]);

  const zoom = ZOOM_STEPS[zoomIndex]!;
  const width = Math.max(240, Math.round((baseWidth - 2) * zoom));

  useEffect(() => {
    const container = pagesRef.current;
    if (!pdf || !container || !baseWidth) return;
    let cancelled = false;
    const renders: { cancel: () => void }[] = [];
    const drawn: HTMLCanvasElement[] = [];

    const draw = async (canvas: HTMLCanvasElement, pageNumber: number) => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const viewport = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * ratio });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const task = page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport });
      renders.push(task);
      await task.promise.catch(() => undefined);
      if (cancelled) return;
      canvas.dataset.drawn = 'true';
      drawn.push(canvas);
      if (drawn.length > MAX_DRAWN_PAGES) {
        const old = drawn.shift()!;
        delete old.dataset.drawn;
        old.width = old.height = 0;
      }
    };

    // Очередь отрисовки: строго по одной странице, как на сайте группы. Несколько page.render разом
    // забивали главный поток прямо во время прокрутки — отсюда рывки. Страницы у экрана — вне очереди.
    const queue: HTMLCanvasElement[] = [];
    let busy = false;
    const pump = async () => {
      if (busy) return;
      busy = true;
      while (queue.length && !cancelled) {
        const canvas = queue.shift()!;
        if (canvas.dataset.drawn) continue;
        await draw(canvas, Number(canvas.dataset.page));
      }
      busy = false;
    };
    const enqueue = (canvas: HTMLCanvasElement, urgent: boolean) => {
      if (canvas.dataset.drawn) return;
      const at = queue.indexOf(canvas);
      if (at !== -1) queue.splice(at, 1);
      if (urgent) queue.unshift(canvas);
      else queue.push(canvas);
      void pump();
    };

    const preload = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && enqueue(entry.target as HTMLCanvasElement, true)),
      { rootMargin: PRELOAD_MARGIN },
    );
    // Текущая страница — та, что пересекает середину экрана
    const middle = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && setCurrent(Number((entry.target as HTMLElement).dataset.page))),
      { rootMargin: '-50% 0px -50% 0px' },
    );

    const canvases = Array.from({ length: pdf.numPages }, (_, index) => {
      const canvas = document.createElement('canvas');
      canvas.className = styles.page!;
      canvas.dataset.page = String(index + 1);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${Math.round(width * 1.414)}px`;
      return canvas;
    });
    container.replaceChildren(...canvases);
    // Точная высота каждой страницы — сразу, до отрисовки (страницы бывают разного формата)
    canvases.forEach((canvas, index) => {
      void pdf.getPage(index + 1).then((page) => {
        const { width: w, height: h } = page.getViewport({ scale: 1 });
        if (!cancelled) canvas.style.height = `${Math.round((width * h) / w)}px`;
      });
      preload.observe(canvas);
      middle.observe(canvas);
    });
    // Остальные — заранее, в фоне (не больше, чем держим в памяти)
    canvases.slice(0, MAX_DRAWN_PAGES).forEach((canvas) => enqueue(canvas, false));

    return () => {
      cancelled = true;
      preload.disconnect();
      middle.disconnect();
      renders.forEach((task) => task.cancel());
    };
  }, [pdf, width, baseWidth]);

  const scrollToPage = useCallback((page: number, behavior: ScrollBehavior = 'smooth') => {
    pagesRef.current?.children[page - 1]?.scrollIntoView({ behavior, block: 'start' });
  }, []);

  // К далёкой странице — сразу, без плавной прокрутки через сотню страниц. Высоты страниц выше
  // уточняются асинхронно, поэтому ждём их, иначе остановимся на соседней
  async function resumeReading() {
    if (!pdf) return;
    const target = resume;
    setResume(0);
    await Promise.all(Array.from({ length: target }, (_, index) => pdf.getPage(index + 1)));
    requestAnimationFrame(() => scrollToPage(target, 'instant'));
  }

  if (failed) {
    return (
      <div className={styles.error}>
        <p>Не удалось показать PDF здесь.</p>
        <p className={styles.reason}>{failed}</p>
        <a href={file} target="_blank" rel="noopener noreferrer" className={styles.openLink}>
          Открыть файл →
        </a>
      </div>
    );
  }

  const numPages = pdf?.numPages ?? 0;

  return (
    <div ref={rootRef} className={styles.viewer}>
      <div className={styles.toolbar}>
        <div className={styles.group}>
          <IconButton icon={ChevronUp} label="Предыдущая страница" size="sm" disabled={current <= 1} onClick={() => scrollToPage(current - 1)} />
          <span className={styles.pageLabel}>{numPages ? `${current} / ${numPages}` : '—'}</span>
          <IconButton
            icon={ChevronDown}
            label="Следующая страница"
            size="sm"
            disabled={current >= numPages}
            onClick={() => scrollToPage(current + 1)}
          />
          {pdf && resume > 1 && resume <= numPages && (
            <button type="button" className={styles.resume} onClick={() => void resumeReading()}>
              <BookmarkCheck size={14} strokeWidth={1.75} aria-hidden />
              <span className={styles.resumeText}>Продолжить с</span> {resume} стр.
            </button>
          )}
        </div>
        <div className={styles.group}>
          <IconButton icon={Minus} label="Уменьшить" size="sm" disabled={zoomIndex === 0} onClick={() => setZoomIndex((index) => index - 1)} />
          <span className={styles.pageLabel}>{Math.round(zoom * 100)}%</span>
          <IconButton
            icon={Plus}
            label="Увеличить"
            size="sm"
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            onClick={() => setZoomIndex((index) => index + 1)}
          />
          <IconButton icon={Maximize2} label="По ширине" size="sm" disabled={zoom === 1} onClick={() => setZoomIndex(ZOOM_STEPS.indexOf(1))} />
          <IconButton
            icon={dark ? Sun : Moon}
            label={dark ? 'Светлые страницы' : 'Тёмные страницы'}
            size="sm"
            aria-pressed={dark}
            onClick={() => setAppearance({ pdfDark: !dark })}
          />
          <a className={styles.open} href={file} target="_blank" rel="noopener noreferrer" title="Открыть файл в новой вкладке">
            <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
          </a>
        </div>
      </div>

      <div className={styles.scroller}>
        {!pdf && <p className={styles.loading}>Загрузка PDF…</p>}
        {/* Холсты страниц добавляются сюда вручную — у React здесь нет детей, и он их не трогает */}
        <div ref={pagesRef} className={cn(styles.document, dark && styles.dark)} />
      </div>
    </div>
  );
}
