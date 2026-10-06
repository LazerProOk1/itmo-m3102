import { resolveColor, SERIES_COLORS, textWidth, unquote, wrapText, type DiagramLines } from './parse';
import { niceStep } from './Plot';
import { runArrayProgram, type ArrayStep } from './arrayCode.js';
import styles from './Diagrams.module.css';

/* ---------------- tree: иерархия отступами ---------------- */

export interface TreeNode {
  label: string;
  children: TreeNode[];
}

export function parseTree({ body }: DiagramLines): TreeNode {
  const roots: TreeNode[] = [];
  const stack: { indent: number; node: TreeNode }[] = [];
  for (const { raw } of body) {
    const indent = raw.length - raw.trimStart().length;
    const node: TreeNode = { label: raw.trim(), children: [] };
    while (stack.length && stack[stack.length - 1]!.indent >= indent) stack.pop();
    if (stack.length) stack[stack.length - 1]!.node.children.push(node);
    else roots.push(node);
    stack.push({ indent, node });
  }
  if (roots.length === 0) throw new Error('Пустое дерево');
  return roots.length === 1 ? roots[0]! : { label: '', children: roots };
}

interface PlacedNode {
  node: TreeNode;
  x: number;
  depth: number;
  lines: string[];
  w: number;
  parent?: PlacedNode;
}

/** Листья — по слотам слева направо, родитель — посередине над детьми */
export function TreeView({ tree }: { tree: TreeNode }) {
  const placed: PlacedNode[] = [];
  const all: { node: TreeNode; depth: number }[] = [];
  const collect = (node: TreeNode, depth: number) => {
    all.push({ node, depth });
    node.children.forEach((child) => collect(child, depth + 1));
  };
  collect(tree, 0);
  const sizes = new Map(
    all.map(({ node }) => {
      const lines = wrapText(node.label, 24);
      return [node, { lines, w: Math.max(40, ...lines.map((line) => textWidth(line) + 22)) }];
    }),
  );
  const slot = Math.min(Math.max(...[...sizes.values()].map((size) => size.w)) + 16, 220);
  const rowHeight = Math.max(...[...sizes.values()].map((size) => size.lines.length)) * 15 + 52;

  let leaf = 0;
  const place = (node: TreeNode, depth: number, parent?: PlacedNode): PlacedNode => {
    const size = sizes.get(node)!;
    const self: PlacedNode = { node, x: 0, depth, lines: size.lines, w: size.w, parent };
    placed.push(self);
    if (node.children.length === 0) {
      self.x = leaf++ * slot + slot / 2;
    } else {
      const children = node.children.map((child) => place(child, depth + 1, self));
      self.x = (children[0]!.x + children[children.length - 1]!.x) / 2;
    }
    return self;
  };
  place(tree, 0);
  // Пустой корень (несколько деревьев) не рисуем
  const visible = placed.filter((item) => item.node.label !== '' || item.depth > 0);
  const width = leaf * slot;
  const depthMax = Math.max(...visible.map((item) => item.depth));
  const height = (depthMax + 1) * rowHeight;
  const y = (depth: number) => depth * rowHeight + rowHeight / 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.svg} style={{ maxWidth: Math.max(width, 240), minWidth: width * 0.7 }} role="img">
      {visible.map((item, index) =>
        item.parent && item.parent.node.label !== '' ? (
          <path
            key={`e${index}`}
            className={styles.edge}
            d={`M${item.parent.x},${y(item.parent.depth) + 14} C${item.parent.x},${y(item.depth) - 30} ${item.x},${y(item.parent.depth) + 30} ${item.x},${y(item.depth) - 14}`}
          />
        ) : null,
      )}
      {visible.map((item, index) => {
        const h = item.lines.length * 15 + 12;
        return (
          <g key={index} className={styles.nodeGroup}>
            <rect
              className={item.depth === 0 ? styles.nodeAccent : styles.node}
              x={item.x - item.w / 2}
              y={y(item.depth) - h / 2}
              width={item.w}
              height={h}
              rx={8}
            />
            {item.lines.map((line, lineIndex) => (
              <text
                key={lineIndex}
                className={styles.nodeText}
                x={item.x}
                y={y(item.depth) + (lineIndex - (item.lines.length - 1) / 2) * 15 + 4}
                textAnchor="middle"
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------- array: ячейки с индексами ---------------- */

export interface ArrayModel {
  values: string[];
  highlight: Set<number>;
  sorted: Set<number>;
  /** Код после `code:` — выполняется по шагам безопасным интерпретатором группы (arrayCode.js, без eval) */
  code?: string;
  steps?: ArrayStep[];
  codeLines?: string[];
  /** Имя основного массива (`watch:`), указатели (`pointers: i, j, k@buf`), скрыть код (`hidecode`) */
  watch: string;
  pointerNames: string[];
  hideCode: boolean;
  /** Какой шаг попадает в печать и картинку: `print: first | last | N` */
  printStep: number;
}

function parseList(text: string): string[] {
  const inner = text.trim().replace(/^\[/, '').replace(/\]$/, '');
  return (inner.match(/"(?:[^"\\]|\\.)*"|[^,]+/g) ?? []).map((item) => unquote(item.trim()).replace(/\\0/g, '\\0'));
}

const indices = (text: string) =>
  new Set(
    text
      .split(',')
      .map((part) => Number(part.trim()))
      .filter(Number.isInteger),
  );

const IDENT = /^[A-Za-z_]\w*$/;
const POINTER = /^[A-Za-z_]\w*(?:@[A-Za-z_]\w*)?$/;
/** «5» → 5, «"x"» → "x": код сравнивает числа как числа */
const numeric = (value: string) => (/^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : value);

export function parseArray({ body }: DiagramLines, source: string): ArrayModel {
  const model: ArrayModel = {
    values: [],
    highlight: new Set(),
    sorted: new Set(),
    watch: 'a',
    pointerNames: ['i', 'j', 'k'],
    hideCode: false,
    printStep: 0,
  };
  // Всё после строки «code:» — программа; до неё — разметка массива и опции
  const lines = source.split(/\r?\n/);
  const codeAt = lines.findIndex((line) => /^\s*code\s*:/i.test(line));
  let pointerSpecs = model.pointerNames;
  let buffers: string[] = [];
  let print = 'first';

  for (const { text, line } of body) {
    if (codeAt !== -1 && line > codeAt) break;
    const option = /^(pointers|watch|print|buffers)\s*:\s*(.*)$/i.exec(text);
    if (option) {
      const [key, value] = [option[1]!.toLowerCase(), option[2]!.trim()];
      const names = value.split(/[\s,]+/).filter(Boolean);
      if (key === 'pointers') {
        if (names.length > 8 || names.some((name) => !POINTER.test(name)))
          throw new Error(`Строка ${line}: pointers — имена переменных через запятую (не больше 8), на другой массив — k@buf`);
        pointerSpecs = names;
        model.pointerNames = names.map((name) => name.split('@')[0]!);
      } else if (key === 'buffers') {
        if (names.length > 5 || names.some((name) => !IDENT.test(name)))
          throw new Error(`Строка ${line}: buffers — имена массивов через запятую (не больше 5)`);
        buffers = names;
      } else if (key === 'watch') {
        if (!IDENT.test(value)) throw new Error(`Строка ${line}: watch — ожидалось имя переменной`);
        model.watch = value;
      } else {
        if (!/^(first|last|\d+)$/i.test(value)) throw new Error(`Строка ${line}: print — first, last или номер шага`);
        print = value.toLowerCase();
      }
      continue;
    }
    if (/^hidecode$/i.test(text)) {
      model.hideCode = true;
      continue;
    }
    const list = /^(\[.*\])(.*)$/.exec(text);
    if (list) {
      model.values = parseList(list[1]!);
      const highlight = /highlight:\s*([\d,\s]+)/.exec(list[2]!);
      if (highlight) model.highlight = indices(highlight[1]!);
      const sorted = /sorted:\s*([\d,\s]+)/.exec(list[2]!);
      if (sorted) model.sorted = indices(sorted[1]!);
      continue;
    }
    const highlight = /^highlight:\s*([\d,\s]+)$/.exec(text);
    if (highlight) model.highlight = indices(highlight[1]!);
  }

  if (codeAt !== -1) {
    const rest = lines[codeAt]!.replace(/^\s*code\s*:\s*/i, '');
    model.code = [...(rest ? [rest] : []), ...lines.slice(codeAt + 1)].join('\n').trimEnd();
    if (!model.code.trim()) throw new Error(`Строка ${codeAt + 1}: после «code:» нужна программа`);
    if (buffers.includes(model.watch)) throw new Error(`buffers: «${model.watch}» — основной массив, буфером он быть не может`);
    const run = runArrayProgram(model.code, {
      base: rest ? codeAt : codeAt + 1,
      watch: model.watch,
      pointers: pointerSpecs,
      buffers,
      initial: model.values.map(numeric),
    });
    model.steps = run.steps;
    model.codeLines = run.codeLines;
    const last = run.steps.length - 1;
    model.printStep = print === 'last' ? last : /^\d+$/.test(print) ? Math.max(0, Math.min(last, Number(print) - 1)) : 0;
    // Массив мог появиться только в коде (let a = [...]) — для картинки берём кадр печати
    model.values = run.steps[model.printStep]?.vals ?? model.values;
  }
  if (model.values.length === 0) throw new Error('Нет массива: нужна строка вида [5, 2, 9]');
  return model;
}

/** Кадр печати (print:) как обычный массив: подсветка — что сравнивали и писали на этом шаге, готовые ячейки — зелёным */
export function frameOf(model: ArrayModel): ArrayModel {
  const step = model.steps?.[model.printStep];
  if (!step) return model;
  return {
    ...model,
    values: step.vals,
    highlight: new Set([...(step.cmp ?? []), ...(step.write ?? []), ...(step.swap ?? []), ...(step.read ?? [])]),
    sorted: new Set(step.done),
  };
}

export function ArrayView({ model }: { model: ArrayModel }) {
  const cell = Math.max(44, ...model.values.map((value) => textWidth(value, 13) + 18));
  const width = model.values.length * cell + 2;
  return (
    <div className={styles.arrayWrap}>
      <svg viewBox={`0 0 ${width} 72`} className={styles.svg} style={{ maxWidth: width }} role="img">
        {model.values.map((value, index) => (
          <g key={index}>
            <rect
              className={model.highlight.has(index) ? styles.cellHighlight : model.sorted.has(index) ? styles.cellSorted : styles.cell}
              x={1 + index * cell}
              y={4}
              width={cell}
              height={44}
            />
            <text className={styles.cellText} x={1 + index * cell + cell / 2} y={31} textAnchor="middle">
              {value}
            </text>
            <text className={styles.tick} x={1 + index * cell + cell / 2} y={66} textAnchor="middle">
              {index}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ---------------- chart: bar / line / pie / scatter ---------------- */

export interface ChartModel {
  type: 'bar' | 'line' | 'pie' | 'scatter';
  series: string[];
  rows: { label: string; values: number[] }[];
}

export function parseChart({ header, body }: DiagramLines): ChartModel {
  const type = (['bar', 'line', 'pie', 'scatter'] as const).find((name) => header.variant.includes(name)) ?? 'bar';
  const model: ChartModel = { type, series: [], rows: [] };
  for (const { text, line } of body) {
    const series = /^series:\s*(.+)$/.exec(text);
    if (series) {
      model.series = series[1]!.split('|').map((name) => name.trim());
      continue;
    }
    // Подписи осей «x: n = 1..10» — только для чтения исходника, на рисунке подписи берутся из строк
    if (/^[xy]:\s/.test(text)) continue;
    // Второй формат строк: «n=1: 2» — подпись и одно значение через двоеточие
    const colon = /^(.+):\s*(-?[\d.]+)$/.exec(text);
    const cells = text.includes('|') || !colon ? text.split('|').map((cell) => cell.trim()) : [colon[1]!.trim(), colon[2]!];
    const values = cells.slice(1).map(Number);
    if (cells.length < 2 || values.some((value) => !Number.isFinite(value))) throw new Error(`Строка ${line}: нужно «подпись | число | …»`);
    model.rows.push({ label: unquote(cells[0]!), values });
  }
  if (model.rows.length === 0) throw new Error('Нет данных для диаграммы');
  if (model.series.length === 0) model.series = model.rows[0]!.values.map((_, index) => `Ряд ${index + 1}`);
  return model;
}

export function ChartView({ model }: { model: ChartModel }) {
  const width = 640;
  const height = 300;
  const legend = model.series.length > 1;
  // Легенда — отдельной строкой над графиком, чтобы не налезать на столбцы
  const margin = { top: legend ? 40 : 16, right: 16, bottom: 34, left: 44 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const values = model.rows.flatMap((row) => row.values);
  // Круглые деления (0, 20, 40…), шкала доходит до ближайшего деления выше максимума
  const step = niceStep(Math.max(0, ...values) - Math.min(0, ...values) || 1, 4);
  const min = Math.floor(Math.min(0, ...values) / step) * step;
  const max = Math.ceil(Math.max(0, ...values) / step) * step;
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => Math.round((min + index * step) * 1e6) / 1e6);
  const sy = (value: number) => margin.top + innerH - ((value - min) / (max - min || 1)) * innerH;

  if (model.type === 'pie') {
    const total = model.rows.reduce((sum, row) => sum + Math.max(0, row.values[0] ?? 0), 0) || 1;
    let angle = -Math.PI / 2;
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className={`${styles.svg} ${styles.chart}`} role="img">
        {model.rows.map((row, index) => {
          const share = Math.max(0, row.values[0] ?? 0) / total;
          const start = angle;
          angle += share * Math.PI * 2;
          const [cx, cy, r] = [180, height / 2, 120];
          const large = share > 0.5 ? 1 : 0;
          const d = `M${cx},${cy} L${cx + r * Math.cos(start)},${cy + r * Math.sin(start)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)} Z`;
          return (
            <g key={index}>
              <path
                d={share >= 0.9999 ? `M${cx - r},${cy} a${r},${r} 0 1 0 ${2 * r},0 a${r},${r} 0 1 0 ${-2 * r},0` : d}
                fill={resolveColor(undefined, index)}
                className={styles.slice}
              />
              <rect x={340} y={40 + index * 24} width={12} height={12} rx={3} fill={resolveColor(undefined, index)} />
              <text className={styles.legendText} x={360} y={50 + index * 24}>
                {row.label} — {Math.round(share * 100)}%
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  // Подписи легенды подряд по их длине, по центру над графиком
  const legendWidths = model.series.map((name) => 18 + textWidth(name, 14) + 20);
  let legendCursor = (width - legendWidths.reduce((sum, item) => sum + item, 0)) / 2;
  const legendX = legendWidths.map((item) => (legendCursor += item) - item);
  const band = innerW / model.rows.length;
  const sx = (index: number) => margin.left + band * index + band / 2;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`${styles.svg} ${styles.chart}`} role="img">
      <line className={styles.axis} x1={margin.left} x2={margin.left + innerW} y1={sy(0)} y2={sy(0)} />
      {ticks.map((value) => (
        <g key={value}>
          <line className={styles.grid} x1={margin.left} x2={margin.left + innerW} y1={sy(value)} y2={sy(value)} />
          <text className={styles.tick} x={margin.left - 8} y={sy(value) + 4} textAnchor="end">
            {value}
          </text>
        </g>
      ))}
      {model.rows.map((row, index) => (
        <text key={row.label + index} className={styles.tick} x={sx(index)} y={height - 12} textAnchor="middle">
          {row.label}
        </text>
      ))}
      {model.series.map((_, seriesIndex) => {
        const color = SERIES_COLORS[seriesIndex % SERIES_COLORS.length]!;
        if (model.type === 'bar') {
          const barW = (band * 0.7) / model.series.length;
          return model.rows.map((row, index) => {
            const value = row.values[seriesIndex] ?? 0;
            const x = sx(index) - (band * 0.7) / 2 + seriesIndex * barW;
            return (
              <rect
                key={`${seriesIndex}-${index}`}
                className={styles.bar}
                x={x}
                y={Math.min(sy(value), sy(0))}
                width={barW - 2}
                height={Math.abs(sy(value) - sy(0))}
                rx={3}
                fill={color}
              />
            );
          });
        }
        const points = model.rows.map((row, index) => `${sx(index)},${sy(row.values[seriesIndex] ?? 0)}`);
        return (
          <g key={seriesIndex}>
            {model.type === 'line' && <polyline className={styles.curve} points={points.join(' ')} stroke={color} />}
            {model.rows.map((row, index) => (
              <circle key={index} cx={sx(index)} cy={sy(row.values[seriesIndex] ?? 0)} r={4} fill={color} />
            ))}
          </g>
        );
      })}
      {legend &&
        model.series.map((name, index) => (
          <g key={name} transform={`translate(${legendX[index]}, 8)`}>
            <rect width={12} height={12} rx={3} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
            <text className={styles.legendText} x={18} y={10}>
              {name}
            </text>
          </g>
        ))}
    </svg>
  );
}
