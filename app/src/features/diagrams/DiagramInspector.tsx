import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { readEdge, readNode, updateEdge, updateNode } from './diagramEdits';
import styles from './DiagramEditorPage.module.css';

export type Selection = { node: string } | { edge: number } | { shape: number } | null;

const COLORS = [
  ['', 'Как обычно'],
  ['red', 'Красный'],
  ['orange', 'Оранжевый'],
  ['green', 'Зелёный'],
  ['blue', 'Синий'],
  ['purple', 'Фиолетовый'],
  ['gray', 'Серый'],
] as const;
const SHAPES = [
  ['box', 'Прямоугольник'],
  ['round', 'Скруглённый'],
  ['diamond', 'Ромб (условие)'],
  ['circle', 'Круг'],
  ['db', 'База данных'],
] as const;

interface DiagramInspectorProps {
  lang: string;
  source: string;
  selection: Selection;
  onChange: (source: string) => void;
}

/**
 * Свойства выбранного на холсте: подпись, цвет, форма вершины; вес, цвет, пунктир и направление ребра.
 * Каждое изменение — правка строки исходного текста (diagramEdits.ts), её видно слева и в конспекте.
 */
export function DiagramInspector({ lang, source, selection, onChange }: DiagramInspectorProps) {
  const graphLike = lang === 'graph' || lang === 'diagram';

  if (graphLike && selection && 'node' in selection) {
    const kind = lang as 'graph' | 'diagram';
    const node = readNode(source, kind, selection.node);
    const apply = (change: Partial<{ label: string; color: string; shape: string }>) =>
      onChange(updateNode(source, kind, selection.node, { label: node.label, color: node.color, shape: node.shape, ...change }));
    return (
      <section className={styles.inspector} aria-label="Свойства вершины">
        <p className={styles.inspectorHead}>
          {lang === 'graph' ? 'Вершина' : 'Блок'} {selection.node}
        </p>
        <Field label="Подпись">
          {/* key: другая вершина — новое поле со своим значением */}
          <Input
            key={`${selection.node}:${node.label}`}
            defaultValue={node.label}
            onBlur={(event) => event.target.value !== node.label && apply({ label: event.target.value })}
          />
        </Field>
        {kind === 'diagram' ? (
          <Field label="Форма">
            <select className={styles.select} value={node.shape} onChange={(event) => apply({ shape: event.target.value })}>
              {SHAPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Цвет">
            <select className={styles.select} value={node.color ?? ''} onChange={(event) => apply({ color: event.target.value || undefined })}>
              {COLORS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </section>
    );
  }

  if (graphLike && selection && 'edge' in selection) {
    const edge = readEdge(source, selection.edge);
    if (!edge) return null;
    const apply = (change: Partial<{ label: string; color?: string; dashed: boolean; directed: boolean }>) =>
      onChange(
        updateEdge(source, selection.edge, { label: edge.label, color: edge.color, dashed: edge.dashed, directed: edge.arrow !== '--', ...change }),
      );
    return (
      <section className={styles.inspector} aria-label="Свойства ребра">
        <p className={styles.inspectorHead}>
          Ребро {edge.from} → {edge.to}
        </p>
        <Field label="Вес / подпись">
          <Input
            key={`${selection.edge}:${edge.label}`}
            defaultValue={edge.label}
            onBlur={(event) => event.target.value !== edge.label && apply({ label: event.target.value })}
          />
        </Field>
        <Field label="Цвет">
          <select className={styles.select} value={edge.color ?? ''} onChange={(event) => apply({ color: event.target.value || undefined })}>
            {COLORS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <label className={styles.check}>
          <input type="checkbox" checked={edge.arrow !== '--'} onChange={(event) => apply({ directed: event.target.checked })} />
          Со стрелкой
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={edge.dashed} onChange={(event) => apply({ dashed: event.target.checked })} />
          Пунктир
        </label>
      </section>
    );
  }

  const hint =
    lang === 'graph' || lang === 'diagram'
      ? 'Нажмите на вершину или ребро, чтобы изменить подпись и цвет. Вершины перетаскиваются мышью.'
      : lang === 'canvas'
        ? 'Фигуры перетаскиваются мышью. «Добавить» — новый прямоугольник там, где нажмёте.'
        : 'Меняйте текст слева — картинка обновляется сразу.';
  return <p className={styles.inspectorHint}>{hint}</p>;
}
