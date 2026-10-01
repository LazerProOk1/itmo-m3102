import { useMemo, type ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { cn } from '../../lib/cn';
import { convertContainerCallouts, remarkCallouts } from '../../lib/remarkCallouts';
import { convertWikiLinks } from '../../lib/wikiLinks';
import { WikiLinkAnchor } from '../../features/materials/WikiLink';
import { DIAGRAM_LANGUAGES, DiagramBlock, isDiagramLanguage } from '../diagrams/DiagramBlock';
import { MermaidBlock } from './MermaidBlock';
import styles from './Markdown.module.css';

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
  [rehypeHighlight, { plainText: ['mermaid', ...DIAGRAM_LANGUAGES] }],
];

/**
 * Markdown конспектов и ДЗ: GFM, формулы KaTeX, выноски Obsidian `> [!тип]`, подсветка кода,
 * схемы mermaid и [[wiki-ссылки]] между конспектами.
 */
export function Markdown({ content, sourceRef, baseUrl, className }: MarkdownProps) {
  const withWikiLinks = useMemo(() => convertWikiLinks(convertContainerCallouts(content)), [content]);

  return (
    <div className={cn(styles.markdown, className)}>
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
            if (code?.type !== 'element' || !lang || (lang !== 'mermaid' && !isDiagramLanguage(lang))) return <pre {...rest}>{children}</pre>;
            const source = code.children.map((child) => (child.type === 'text' ? child.value : '')).join('').trimEnd();
            return lang === 'mermaid' ? <MermaidBlock source={source} /> : <DiagramBlock lang={lang} source={source} />;
          },
        }}
      >
        {withWikiLinks}
      </ReactMarkdown>
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
