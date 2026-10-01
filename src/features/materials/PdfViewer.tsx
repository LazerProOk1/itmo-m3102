import { ChevronDown, ChevronUp, ExternalLink, Maximize2, Minus, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { IconButton } from '../../components/ui/IconButton';
import { usePrefersReducedMotion } from '../../lib/motion';
import styles from './PdfViewer.module.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

interface PdfViewerProps {
  /** data: URI (загружен локально) или ссылка на файл */
  file: string;
}

const ZOOM_STEPS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2];
/** Рисуются только страницы в пределах этого расстояния от экрана, остальные выгружаются */
const PRELOAD_MARGIN = '1600px 0px';
/** Холст страницы занимает ширина × высота × плотность² × 4 байта — на 3x-экранах это десятки МБ */
const MAX_PIXEL_RATIO = 2;

/**
 * PDF целиком, сплошной лентой — листается обычной прокруткой. Рисуются только страницы рядом
 * с экраном, дальние выгружаются: иначе у толстых учебников холсты съедают память и браузер
 * перезагружает вкладку. Высота каждой страницы фиксирована — прокрутка не прыгает.
 * Панель сверху: страница, масштаб, «по ширине», открыть файл.
 */
export function PdfViewer({ file }: PdfViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [ratio, setRatio] = useState(1.414);
  const [width, setWidth] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(ZOOM_STEPS.indexOf(1));
  const [current, setCurrent] = useState(1);
  const [failed, setFailed] = useState(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    setWidth(Math.floor(root.getBoundingClientRect().width));
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const zoom = ZOOM_STEPS[zoomIndex]!;
  const pageWidth = Math.max(240, Math.round((width - 2) * zoom));

  const scrollToPage = useCallback((page: number) => {
    pageRefs.current[page - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (failed) {
    return (
      <div className={styles.error}>
        <p>Не удалось показать PDF здесь.</p>
        <a href={file} target="_blank" rel="noopener noreferrer" className={styles.openLink}>
          Открыть файл →
        </a>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={styles.viewer}>
      <div className={styles.toolbar}>
        <div className={styles.group}>
          <IconButton icon={ChevronUp} label="Предыдущая страница" size="sm" disabled={current <= 1} onClick={() => scrollToPage(current - 1)} />
          <span className={styles.pageLabel}>
            {numPages ? `${current} / ${numPages}` : '—'}
          </span>
          <IconButton icon={ChevronDown} label="Следующая страница" size="sm" disabled={current >= numPages} onClick={() => scrollToPage(current + 1)} />
        </div>
        <div className={styles.group}>
          <IconButton icon={Minus} label="Уменьшить" size="sm" disabled={zoomIndex === 0} onClick={() => setZoomIndex((index) => index - 1)} />
          <span className={styles.pageLabel}>{Math.round(zoom * 100)}%</span>
          <IconButton icon={Plus} label="Увеличить" size="sm" disabled={zoomIndex === ZOOM_STEPS.length - 1} onClick={() => setZoomIndex((index) => index + 1)} />
          <IconButton icon={Maximize2} label="По ширине" size="sm" disabled={zoom === 1} onClick={() => setZoomIndex(ZOOM_STEPS.indexOf(1))} />
          <a className={styles.open} href={file} target="_blank" rel="noopener noreferrer" title="Открыть файл в новой вкладке">
            <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
          </a>
        </div>
      </div>

      <div className={styles.scroller}>
        <Document
          file={file}
          onLoadSuccess={async (pdf) => {
            setNumPages(pdf.numPages);
            const first = await pdf.getPage(1);
            const viewport = first.getViewport({ scale: 1 });
            setRatio(viewport.height / viewport.width);
          }}
          onLoadError={() => setFailed(true)}
          loading={<p className={styles.loading}>Загрузка PDF…</p>}
          className={styles.document}
        >
          {width > 0 &&
            Array.from({ length: numPages }, (_, index) => (
              <LazyPage
                key={index}
                pageNumber={index + 1}
                width={pageWidth}
                height={Math.round(pageWidth * ratio)}
                onCurrent={setCurrent}
                ref={(element) => {
                  pageRefs.current[index] = element;
                }}
              />
            ))}
        </Document>
      </div>
    </div>
  );
}

interface LazyPageProps {
  pageNumber: number;
  width: number;
  height: number;
  onCurrent: (page: number) => void;
  ref: (element: HTMLDivElement | null) => void;
}

function LazyPage({ pageNumber, width, height, onCurrent, ref }: LazyPageProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(pageNumber <= 2);
  const [rendered, setRendered] = useState(false);
  /** Своё соотношение сторон — страницы бывают разного формата; до загрузки — как у первой */
  const [ratio, setRatio] = useState<number | null>(null);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const preload = new IntersectionObserver(
      ([entry]) => {
        setNear(entry!.isIntersecting);
        if (!entry!.isIntersecting) setRendered(false);
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    // Текущая страница — та, что пересекает середину экрана
    const middle = new IntersectionObserver(([entry]) => entry!.isIntersecting && onCurrent(pageNumber), { rootMargin: '-50% 0px -50% 0px' });
    preload.observe(element);
    middle.observe(element);
    return () => {
      preload.disconnect();
      middle.disconnect();
    };
  }, [pageNumber, onCurrent]);

  return (
    <div
      ref={(element) => {
        elementRef.current = element;
        ref(element);
      }}
      className={styles.page}
      style={{ width, height: ratio ? Math.round(width * ratio) : height }}
      data-page={pageNumber}
    >
      {near && (
        <motion.div initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: rendered ? 1 : 0 }} transition={{ duration: 0.25 }}>
          <Page
            pageNumber={pageNumber}
            width={width}
            devicePixelRatio={Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)}
            loading={null}
            onLoadSuccess={(page) => setRatio(page.originalHeight / page.originalWidth)}
            onRenderSuccess={() => setRendered(true)}
          />
        </motion.div>
      )}
    </div>
  );
}
