import { motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { usePrefersReducedMotion } from '../../lib/motion';
import { GraphView, parseGraph } from './Graph';
import { parsePlot, PlotView } from './Plot';
import { splitLines, type DiagramHeader } from './parse';
import { ArrayView, ChartView, parseArray, parseChart, parseTree, TreeView } from './TreeArrayChart';
import styles from './Diagrams.module.css';

/** Языки fenced-блоков, которые сайт группы рисует картинкой (README их репозитория) */
export const DIAGRAM_LANGUAGES = ['graph', 'plot', 'chart', 'tree', 'array', 'diagram'] as const;
export type DiagramLanguage = (typeof DIAGRAM_LANGUAGES)[number];

export const isDiagramLanguage = (lang: string): lang is DiagramLanguage => (DIAGRAM_LANGUAGES as readonly string[]).includes(lang);

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
      case 'array':
        return { header, view: <ArrayView model={parseArray(lines, source)} /> };
      case 'chart':
        return { header, view: <ChartView model={parseChart(lines)} /> };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Заголовок/подпись могут содержать формулы: «$A \cup B$ — закрашены оба круга» */
function InlineMath({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({ children }) => <>{children}</> }}>
      {text}
    </ReactMarkdown>
  );
}

/** Диаграмма из fenced-блока конспекта: ```plot, ```graph, ```diagram, ```tree, ```array, ```chart */
export function DiagramBlock({ lang, source }: { lang: DiagramLanguage; source: string }) {
  const rendered = useMemo(() => render(lang, source), [lang, source]);
  const reduceMotion = usePrefersReducedMotion();

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
      className={styles.figure}
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
    </motion.figure>
  );
}
