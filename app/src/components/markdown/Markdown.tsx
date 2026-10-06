import { Check, Copy } from 'lucide-react';
import { lazy, memo, Suspense, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { cn } from '../../lib/cn';
import { fitDisplayMath } from '../../lib/fitMath';
import { normalizeMath } from '../../lib/mathCompat';
import { convertContainerCallouts, remarkCallouts } from '../../lib/remarkCallouts';
import { convertWikiLinks } from '../../lib/wikiLinks';
import { WikiLinkAnchor } from '../../features/materials/WikiLink';
import { DIAGRAM_LANGUAGES, isDiagramLanguage } from '../diagrams/languages';
import { Quiz } from '../quiz/Quiz';
import { noteQuizKey, quizPageToMarkdown } from '../quiz/parseQuiz';
import { MermaidBlock } from './MermaidBlock';
import styles from './Markdown.module.css';

// Схемы — в немногих конспектах, а рисовальщик тяжёлый: грузится при первой схеме
const DiagramBlock = lazy(() => import('../diagrams/DiagramBlock').then((module) => ({ default: module.DiagramBlock })));

interface MarkdownProps {
  content: string;
  /** Путь файла в репозитории — для относительных [[wiki-ссылок]] */
  sourceRef?: string;
  /** Адрес папки файла — относительные картинки (`../img/x.svg`) считаются от него */
  baseUrl?: string;
  className?: string;
}

const REMARK_PLUGINS = [remarkGfm, remarkMath, remarkCallouts];
const REHYPE_PLUGINS: ComponentProps<typeof ReactMarkdown>['rehypePlugins'] = [
  rehypeKatex,
  [rehypeHighlight, { plainText: ['mermaid', 'quiz', ...DIAGRAM_LANGUAGES] }],
];

/**
 * Markdown конспектов и ДЗ: GFM, формулы KaTeX, выноски Obsidian `> [!тип]`, подсветка кода,
 * схемы mermaid и [[wiki-ссылки]] между конспектами.
 */
/**
 * memo: разбор markdown с KaTeX и подсветкой — сотни миллисекунд на длинном конспекте. Без memo он
 * повторялся при каждой перерисовке читалки (оглавление отмечает раздел при прокрутке) — и прокрутка дёргалась.
 */
export const Markdown = memo(function Markdown({ content, sourceRef, baseUrl, className }: MarkdownProps) {
  // Файл-тест (mode: quiz) распознаётся и здесь: в браузере могла остаться копия с синхронизации до появления тестов
  const withWikiLinks = useMemo(() => convertWikiLinks(normalizeMath(convertContainerCallouts(quizPageToMarkdown(content)))), [content]);

  // Длинные блочные формулы подгоняем под ширину колонки (повторно — при её изменении: поворот телефона, меню, окно)
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const refit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fitDisplayMath(element));
    };
    fitDisplayMath(element);
    const observer = new ResizeObserver(refit);
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [withWikiLinks]);

  return (
    <div ref={root} className={cn(styles.markdown, className)}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={{
          a: (props) => <WikiLinkAnchor {...props} sourceRef={sourceRef} />,
          img: ({ src, alt, node: _node, ...rest }) => (
            <img {...rest} src={resolveAsset(String(src ?? ''), baseUrl)} alt={alt ?? ''} loading="lazy" />
          ),
          pre: ({ node, children, ...rest }) => {
            const code = node?.children[0];
            const lang = code?.type === 'element' ? /language-(\w+)/.exec(String(code.properties.className ?? ''))?.[1] : undefined;
            if (code?.type !== 'element' || !lang || (lang !== 'mermaid' && lang !== 'quiz' && !isDiagramLanguage(lang)))
              return <CodeBlock {...rest}>{children}</CodeBlock>;
            const source = code.children
              .map((child) => (child.type === 'text' ? child.value : ''))
              .join('')
              .trimEnd();
            if (lang === 'quiz') return <Quiz source={source} quizKey={sourceRef ? noteQuizKey(sourceRef, source) : undefined} />;
            return lang === 'mermaid' ? (
              <MermaidBlock source={source} />
            ) : (
              <Suspense fallback={<div className={styles.blockLoading}>Рисуем схему…</div>}>
                <DiagramBlock lang={lang} source={source} />
              </Suspense>
            );
          },
        }}
      >
        {withWikiLinks}
      </ReactMarkdown>
    </div>
  );
});

/** Блок кода с кнопкой «Копировать» при наведении — как на сайте группы */
function CodeBlock(props: ComponentProps<'pre'>) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.codeBlock}>
      <pre {...props} />
      <button
        type="button"
        className={cn(styles.copy, copied && styles.copied)}
        data-pdf-hide
        aria-label={copied ? 'Скопировано' : 'Копировать код'}
        title={copied ? 'Скопировано' : 'Копировать код'}
        onClick={(event) => {
          const code = event.currentTarget.parentElement?.querySelector('code')?.textContent ?? '';
          void navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check size={14} strokeWidth={2.25} aria-hidden /> : <Copy size={14} strokeWidth={1.75} aria-hidden />}
      </button>
    </div>
  );
}

/** Относительный путь картинки → адрес рядом с файлом конспекта на GitHub; абсолютные не трогаем */
export function resolveAsset(src: string, baseUrl?: string): string {
  if (!baseUrl || !src || /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(src)) return src;
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}
