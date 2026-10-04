import { motion } from 'framer-motion';
import { Copy, Download, PencilLine } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { usePrefersReducedMotion } from '../../lib/motion';
import { CanvasView, parseCanvas } from './Canvas';
import { GraphView, parseGraph } from './Graph';
import { parsePlot, PlotView } from './Plot';
import { splitLines, type DiagramHeader } from './parse';
import { ArrayPlayer } from './ArrayPlayer';
import { ArrayView, ChartView, frameOf, parseArray, parseChart, parseTree, TreeView } from './TreeArrayChart';
import { copySvg, downloadPng, downloadSvg, fileName } from './exportDiagram';
import styles from './Diagrams.module.css';

import type { DiagramLanguage } from './languages';
export { DIAGRAM_LANGUAGES, isDiagramLanguage, type DiagramLanguage } from './languages';

type Rendered = { header: DiagramHeader; view: ReactNode } | { error: string };

function render(lang: DiagramLanguage, source: string): Rendered {
  try {
    const lines = splitLines(source, lang);
    const { header } = lines;
    switch (lang) {
      case 'plot':
        return { header, view: <PlotView model={parsePlot(lines)} width={header.width} height={header.height} /> };
      case 'graph':
      case 'diagram':
        return { header, view: <GraphView model={parseGraph(lines, lang)} /> };
      case 'tree':
        return { header, view: <TreeView tree={parseTree(lines)} /> };
      case 'array': {
        const model = parseArray(lines, source);
        if (!model.steps || model.steps.length < 2) return { header, view: <ArrayView model={model} /> };
        // Код по шагам: живой проигрыватель; рядом скрытый кадр — для «SVG/PNG» и печати
        return {
          header,
          view: (
            <>
              <ArrayPlayer model={model} />
              <div className={styles.printFrame} data-export-frame>
                <ArrayView model={frameOf(model)} />
              </div>
            </>
          ),
        };
      }
      case 'chart':
        return { header, view: <ChartView model={parseChart(lines)} /> };
      case 'canvas':
        return { header, view: <CanvasView model={parseCanvas(lines)} /> };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Текст ошибки диаграммы или undefined — конструктор подсвечивает строку из «Строка N: …» */
export function diagramError(lang: DiagramLanguage, source: string): string | undefined {
  const rendered = render(lang, source);
  return 'error' in rendered ? rendered.error : undefined;
}

/** Заголовок/подпись могут содержать формулы: «$A \cup B$ — закрашены оба круга» */
function InlineMath({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({ children }) => <>{children}</> }}>
      {text}
    </ReactMarkdown>
  );
}

interface DiagramBlockProps {
  lang: DiagramLanguage;
  source: string;
  /** Ссылка «Редактировать» в конструктор — у диаграмм конспектов; в самом конструкторе не нужна */
  editable?: boolean;
}

/** Диаграмма из fenced-блока конспекта: ```plot, ```graph, ```diagram, ```tree, ```array, ```chart, ```canvas */
export function DiagramBlock({ lang, source, editable = true }: DiagramBlockProps) {
  const rendered = useMemo(() => render(lang, source), [lang, source]);
  const reduceMotion = usePrefersReducedMotion();
  const figureRef = useRef<HTMLElement>(null);

  if ('error' in rendered) {
    return (
      <figure className={styles.error}>
        <figcaption>Не удалось построить диаграмму: {rendered.error}</figcaption>
        <pre>
          <code>{source}</code>
        </pre>
      </figure>
    );
  }

  return (
    <motion.figure
      ref={figureRef}
      className={styles.figure}
      data-spot
      data-lang={lang}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
    >
      {rendered.header.title && (
        <div className={styles.title}>
          <InlineMath text={rendered.header.title} />
        </div>
      )}
      <div className={styles.canvas}>{rendered.view}</div>
      {rendered.header.caption && (
        <figcaption className={styles.caption}>
          <InlineMath text={rendered.header.caption} />
        </figcaption>
      )}
      <DiagramTools figureRef={figureRef} name={fileName(rendered.header.title, lang)} lang={lang} source={source} editable={editable} />
    </motion.figure>
  );
}

interface DiagramToolsProps {
  figureRef: React.RefObject<HTMLElement | null>;
  name: string;
  lang: DiagramLanguage;
  source: string;
  editable: boolean;
}

/** Под диаграммой, как на сайте группы: копировать SVG, скачать SVG/PNG, открыть в конструкторе */
export function DiagramTools({ figureRef, name, lang, source, editable }: DiagramToolsProps) {
  const [copied, setCopied] = useState(false);
  // Кадр массива с кодом лежит отдельно: в проигрывателе свои svg — иконки кнопок
  const svg = () =>
    figureRef.current?.querySelector<SVGSVGElement>('[data-export-frame] svg') ??
    figureRef.current?.querySelector<SVGSVGElement>(`.${styles.canvas} svg`) ??
    null;
  const background = () => (figureRef.current ? getComputedStyle(figureRef.current).backgroundColor : '#ffffff');

  return (
    <div className={styles.tools}>
      <button
        type="button"
        onClick={() => {
          const element = svg();
          if (element)
            void copySvg(element).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
        }}
      >
        <Copy size={13} strokeWidth={2} aria-hidden />
        {copied ? 'Скопировано' : 'Копировать SVG'}
      </button>
      <button type="button" onClick={() => svg() && downloadSvg(svg()!, name)}>
        <Download size={13} strokeWidth={2} aria-hidden />
        SVG
      </button>
      <button type="button" onClick={() => svg() && void downloadPng(svg()!, name, background())}>
        <Download size={13} strokeWidth={2} aria-hidden />
        PNG
      </button>
      {editable && (
        <Link to="/diagrams" state={{ lang, source }}>
          <PencilLine size={13} strokeWidth={2} aria-hidden />
          Редактировать
        </Link>
      )}
    </div>
  );
}
