import { lazy, Suspense, type ComponentProps } from 'react';

const Markdown = lazy(() => import('./Markdown').then((module) => ({ default: module.Markdown })));

/**
 * Markdown для мест, которые видны сразу (главная, расписание): разбор с KaTeX и подсветкой кода весит
 * сотни КБ и грузится отдельно. Пока не загрузился — тот же текст без разметки, без скачка высоты.
 */
export function LazyMarkdown(props: ComponentProps<typeof Markdown>) {
  return (
    <Suspense
      fallback={
        <div className={props.className} style={{ whiteSpace: 'pre-wrap' }}>
          {props.content}
        </div>
      }
    >
      <Markdown {...props} />
    </Suspense>
  );
}
