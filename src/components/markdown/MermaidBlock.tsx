import { useEffect, useId, useState } from 'react';
import { useSettingsStore } from '../../features/settings/settingsStore';
import styles from './Markdown.module.css';

type RenderState = { svg: string } | { error: string } | null;

/** ```mermaid — схемы в конспектах 1 потока и группы. mermaid тяжёлый, грузится только при встрече. */
export function MermaidBlock({ source }: { source: string }) {
  const id = `mermaid-${useId().replace(/[^a-z0-9]/gi, '')}`;
  const theme = useSettingsStore((state) => state.theme);
  const dark = document.documentElement.dataset.theme === 'dark';
  const [state, setState] = useState<RenderState>(null);

  useEffect(() => {
    let cancelled = false;
    import('mermaid')
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' });
        const { svg } = await mermaid.render(id, source);
        if (!cancelled) setState({ svg });
      })
      .catch((error: unknown) => !cancelled && setState({ error: error instanceof Error ? error.message : String(error) }));
    return () => {
      cancelled = true;
    };
  }, [id, source, theme, dark]);

  if (!state) return <div className={styles.blockLoading}>Рисуем схему…</div>;
  if ('error' in state) {
    return (
      <figure className={styles.blockError}>
        <figcaption>Не удалось построить схему: {state.error}</figcaption>
        <pre>
          <code>{source}</code>
        </pre>
      </figure>
    );
  }
  // securityLevel: 'strict' — mermaid сам вычищает HTML и скрипты из подписей
  return <div className={styles.mermaid} dangerouslySetInnerHTML={{ __html: state.svg }} />;
}
