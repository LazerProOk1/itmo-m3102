import { useId } from 'react';
import { resolveColor, wrapText, type DiagramLines } from './parse';
import styles from './Diagrams.module.css';

export type CanvasShapeType = 'rect' | 'circle' | 'ellipse' | 'line' | 'arrow' | 'path' | 'text';

export interface CanvasShape {
  type: CanvasShapeType;
  /** Числа и слова строки после имени фигуры, без подписи в кавычках */
  parts: string[];
  label: string;
  color?: string;
  /** Сдвиг от открытых group dx dy */
  dx: number;
  dy: number;
  line: number;
}

export interface CanvasModel {
  width: number;
  height: number;
  shapes: CanvasShape[];
}

const SHAPES = new Set<CanvasShapeType>(['rect', 'circle', 'ellipse', 'line', 'arrow', 'path', 'text']);
const clamp = (value: number, fallback: number) => (Number.isFinite(value) ? Math.max(-10000, Math.min(10000, value)) : fallback);
export const num = (value: string | undefined, fallback = 0) => clamp(Number(value), fallback);

/**
 * `canvas 400x200` — холст с фигурами по координатам (формат сайта группы):
 * `rect x y w h "Текст" fill=#eef`, `circle x y r=30 "q0"`, `ellipse x y rx ry`, `line x1 y1 x2 y2`,
 * `arrow x1 y1 -> x2 y2`, `text x y "Подпись"`, `path M0 0 L10 10`, `group dx dy` … `endgroup`.
 */
export function parseCanvas({ header, body }: DiagramLines): CanvasModel {
  const size = /^(\d+)x(\d+)$/.exec(header.variant[0] ?? '');
  const model: CanvasModel = {
    width: Math.max(120, Math.min(1600, Number(size?.[1] ?? header.width ?? 400))),
    height: Math.max(120, Math.min(1600, Number(size?.[2] ?? header.height ?? 200))),
    shapes: [],
  };
  const groups: { x: number; y: number }[] = [];

  for (const { text, line } of body) {
    const group = /^group\s+(-?[\d.]+)\s+(-?[\d.]+)$/.exec(text);
    if (group) {
      const parent = groups.at(-1) ?? { x: 0, y: 0 };
      groups.push({ x: parent.x + num(group[1]), y: parent.y + num(group[2]) });
      continue;
    }
    if (text === 'endgroup') {
      if (!groups.pop()) throw new Error(`Строка ${line}: нет открытой группы`);
      continue;
    }
    const label = /"([^"]*)"/.exec(text)?.[1] ?? '';
    const clean = text.replace(/"[^"]*"/, '').trim();
    const [type, ...parts] = clean.split(/\s+/);
    if (!SHAPES.has(type as CanvasShapeType)) throw new Error(`Строка ${line}: неизвестная фигура «${type}»`);
    const color = /(?:fill|color)=(#[0-9a-fA-F]{3,6}|[a-z]+)/.exec(clean)?.[1];
    model.shapes.push({
      type: type as CanvasShapeType,
      parts: parts.filter((part) => !/^(fill|color)=/.test(part)),
      label,
      color: color ? resolveColor(color) : undefined,
      dx: groups.at(-1)?.x ?? 0,
      dy: groups.at(-1)?.y ?? 0,
      line,
    });
    if (model.shapes.length > 500) throw new Error(`Строка ${line}: слишком много фигур`);
  }
  if (groups.length) throw new Error('Не закрыта группа: нужна строка endgroup');
  if (model.shapes.length === 0) throw new Error('Пустой холст: добавьте фигуру, например rect 20 20 120 60 "Блок"');
  return model;
}

/** Подпись по центру фигуры: переносится по ширине, строки по 15px */
function Label({ x, y, text, width }: { x: number; y: number; text: string; width: number }) {
  if (!text) return null;
  const lines = wrapText(text, Math.max(4, Math.floor(width / 7)));
  return (
    <>
      {lines.map((line, index) => (
        <text key={index} className={styles.nodeText} x={x} y={y + (index - (lines.length - 1) / 2) * 15 + 4} textAnchor="middle">
          {line}
        </text>
      ))}
    </>
  );
}

function ShapeView({ shape, marker }: { shape: CanvasShape; marker: string }) {
  const p = shape.parts;
  const [x, y] = [num(p[0]) + shape.dx, num(p[1]) + shape.dy];
  const color = shape.color ?? 'var(--color-accent)';
  const stroke = { stroke: color, strokeWidth: 2 };
  switch (shape.type) {
    case 'rect': {
      const [w, h] = [num(p[2], 100), num(p[3], 50)];
      return (
        <>
          <rect x={x} y={y} width={w} height={h} rx={8} style={{ ...stroke, fill: `color-mix(in srgb, ${color} 16%, transparent)` }} />
          <Label x={x + w / 2} y={y + h / 2} text={shape.label} width={w - 12} />
        </>
      );
    }
    case 'circle': {
      const r = num(/r=([\d.]+)/.exec(p.join(' '))?.[1], 25);
      return (
        <>
          <circle cx={x} cy={y} r={r} style={{ ...stroke, fill: 'var(--color-bg)' }} />
          <Label x={x} y={y} text={shape.label} width={r * 1.6} />
        </>
      );
    }
    case 'ellipse': {
      const [rx, ry] = [num(p[2], 40), num(p[3], 25)];
      return (
        <>
          <ellipse cx={x} cy={y} rx={rx} ry={ry} style={{ ...stroke, fill: 'var(--color-bg)' }} />
          <Label x={x} y={y} text={shape.label} width={rx * 1.6} />
        </>
      );
    }
    case 'line':
    case 'arrow': {
      const at = p[2] === '->' ? 3 : 2;
      return (
        <line
          x1={x}
          y1={y}
          x2={num(p[at]) + shape.dx}
          y2={num(p[at + 1]) + shape.dy}
          style={stroke}
          markerEnd={shape.type === 'arrow' ? `url(#${marker})` : undefined}
        />
      );
    }
    case 'text':
      return (
        <text x={x} y={y} className={styles.nodeText} style={{ fill: shape.color ?? 'var(--color-text)', fontSize: 14 }}>
          {shape.label || p.slice(2).join(' ')}
        </text>
      );
    case 'path': {
      // Только команды пути и числа — без этого в d можно было бы протащить что угодно
      const d = p.join(' ');
      if (!/^[MmLlHhVvCcQqZz0-9.,\s-]+$/.test(d)) throw new Error(`Строка ${shape.line}: путь содержит недопустимую команду`);
      return <path d={d} transform={`translate(${shape.dx} ${shape.dy})`} style={{ ...stroke, fill: 'none' }} />;
    }
  }
}

export function CanvasView({ model }: { model: CanvasModel }) {
  const marker = `canvas-arrow-${useId().replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg viewBox={`0 0 ${model.width} ${model.height}`} className={styles.svg} style={{ maxWidth: model.width }} role="img">
      <defs>
        <marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className={styles.arrowHead} />
        </marker>
      </defs>
      {model.shapes.map((shape, index) => (
        <g key={index} data-dgm-shape={index}>
          <ShapeView shape={shape} marker={marker} />
        </g>
      ))}
    </svg>
  );
}
