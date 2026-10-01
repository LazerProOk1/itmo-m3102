import { ExternalLink } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Markdown } from '../../components/markdown/Markdown';
import { buttonClass } from '../../components/ui/Button';
import type { LectureNoteContentType } from '../../types/models';
import styles from './LectureNoteContentView.module.css';

// pdf.js тяжёлый — загружаем его только когда действительно открыт конспект с PDF
const PdfViewer = lazy(() => import('./PdfViewer').then((module) => ({ default: module.PdfViewer })));

interface LectureNoteContentViewProps {
  contentType: LectureNoteContentType;
  content: string;
  /** source_ref конспекта/материала — нужен, чтобы резолвить относительные Obsidian-ссылки [[...]] */
  sourceRef?: string;
  /** Папка файла — от неё считаются относительные картинки в markdown */
  baseUrl?: string;
}

/** Режим просмотра конспекта: рендер зависит от contentType — текст, PDF или карточка со ссылкой. */
export function LectureNoteContentView({ contentType, content, sourceRef, baseUrl }: LectureNoteContentViewProps) {
  if (!content.trim()) {
    return <p className={styles.empty}>Содержимое ещё не добавлено.</p>;
  }

  if (contentType === 'pdf') {
    return (
      <Suspense fallback={<p className={styles.loading}>Загрузка просмотрщика…</p>}>
        <PdfViewer file={content} />
      </Suspense>
    );
  }

  if (contentType === 'link') {
    return (
      <div className={styles.linkCard}>
        <p className={styles.linkUrl}>{safeDecode(content)}</p>
        <a href={content} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
          <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
          Открыть
        </a>
      </div>
    );
  }

  return <Markdown content={content} sourceRef={sourceRef} baseUrl={baseUrl} />;
}

/** Ссылки на файлы репозитория хранятся с %D0%9A… — показываем читаемый путь */
function safeDecode(url: string): string {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}
