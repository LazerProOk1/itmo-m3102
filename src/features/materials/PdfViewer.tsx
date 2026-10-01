import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { IconButton } from '../../components/ui/IconButton';
import { EASE_OUT } from '../../lib/motion';
import styles from './PdfViewer.module.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

interface PdfViewerProps {
  /** data: URI (загружен локально) или ссылка на файл */
  file: string;
}

/**
 * Встроенный просмотрщик PDF — одна страница за раз, номера страниц внизу.
 * Загружается лениво (см. LectureNoteContentView) — pdf.js достаточно тяжёлый,
 * чтобы не тянуть его в основной бандл ради конспектов без PDF.
 */
export function PdfViewer({ file }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [failed, setFailed] = useState(false);

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
    <div className={styles.viewer}>
      <Document
        file={file}
        onLoadSuccess={({ numPages: total }) => setNumPages(total)}
        onLoadError={() => setFailed(true)}
        loading={<p className={styles.loading}>Загрузка PDF…</p>}
        className={styles.document}
      >
        {/* Короткий crossfade между страницами вместо жёсткой замены */}
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={pageNumber}
            className={styles.pageWrap}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            <Page pageNumber={pageNumber} width={480} />
          </motion.div>
        </AnimatePresence>
      </Document>

      {numPages > 1 && (
        <div className={styles.nav}>
          <IconButton
            icon={ChevronLeft}
            label="Предыдущая страница"
            size="sm"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((page) => page - 1)}
          />
          <span className={styles.pageLabel}>
            {pageNumber} / {numPages}
          </span>
          <IconButton
            icon={ChevronRight}
            label="Следующая страница"
            size="sm"
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber((page) => page + 1)}
          />
        </div>
      )}
    </div>
  );
}
