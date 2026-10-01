import { useMemo, type ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { cn } from '../../lib/cn';
import { remarkCallouts } from '../../lib/remarkCallouts';
import { convertWikiLinks } from '../../lib/wikiLinks';
import { WikiLinkAnchor } from '../../features/materials/WikiLink';
import { MermaidBlock } from './MermaidBlock';
import styles from './Markdown.module.css';

interface MarkdownProps {
  content: string;
  /** Путь файла в репозитории — для относительных [[wiki-ссылок]] */
  sourceRef?: string;
  className?: string;
}

const REMARK_PLUGINS = [remarkGfm, remarkMath, remarkCallouts];
const REHYPE_PLUGINS: ComponentProps<typeof ReactMarkdown>['rehypePlugins'] = [
  rehypeKatex,
  [rehypeHighlight, { plainText: ['mermaid'] }],
];

/**
 * Markdown конспектов и ДЗ: GFM, формулы KaTeX, выноски Obsidian `> [!тип]`, подсветка кода,
 * схемы mermaid и [[wiki-ссылки]] между конспектами.
 */
export function Markdown({ content, sourceRef, className }: MarkdownProps) {
  const withWikiLinks = useMemo(() => convertWikiLinks(content), [content]);

  return (
    <div className={cn(styles.markdown, className)}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={{
          a: (props) => <WikiLinkAnchor {...props} sourceRef={sourceRef} />,
          pre: ({ node, children, ...rest }) => {
            const code = node?.children[0];
            const isMermaid =
              code?.type === 'element' && String(code.properties.className ?? '').includes('language-mermaid');
            if (!isMermaid) return <pre {...rest}>{children}</pre>;
            const source = code.children.map((child) => (child.type === 'text' ? child.value : '')).join('');
            return <MermaidBlock source={source.trimEnd()} />;
          },
        }}
      >
        {withWikiLinks}
      </ReactMarkdown>
    </div>
  );
}
