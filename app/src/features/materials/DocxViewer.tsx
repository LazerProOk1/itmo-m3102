import { useEffect, useState } from 'react';
import markdownStyles from '../../components/markdown/Markdown.module.css';
import { cn } from '../../lib/cn';
import { sanitizeHtml } from '../../lib/sanitizeHtml';
import styles from './DocxViewer.module.css';

interface DocxViewerProps {
  file: string;
}

/**
 * Просмотр .docx прямо на сайте: mammoth (грузится только тут) переводит файл в HTML, дальше — чистка и оформление как у
 * конспектов. Это упрощённый вид: сложная вёрстка Word (колонки, поля, формулы-картинки) может отличаться от оригинала.
 */
export function DocxViewer({ file }: DocxViewerProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setHtml(null);
    setError('');
    (async () => {
      try {
        const [{ default: mammoth }, response] = await Promise.all([import('mammoth'), fetch(file)]);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const { value } = await mammoth.convertToHtml({ arrayBuffer: await response.arrayBuffer() });
        if (active) setHtml(sanitizeHtml(value));
      } catch (reason) {
        console.warn('DOCX не открылся:', reason);
        if (active) setError('Не удалось открыть документ — скачайте его и откройте в Word.');
      }
    })();
    return () => {
      active = false;
    };
  }, [file]);

  if (error) return <p className={styles.state}>{error}</p>;
  if (html === null) return <p className={styles.state}>Загрузка документа…</p>;
  if (!html.trim()) return <p className={styles.state}>В документе нет текста.</p>;

  return (
    <>
      <p className={styles.hint}>Документ Word показан упрощённо: оформление может отличаться от оригинала.</p>
      <div className={cn(markdownStyles.markdown, styles.docx)} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
