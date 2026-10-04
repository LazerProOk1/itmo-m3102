import { useId, type CSSProperties } from 'react';
import { resolveColor, takeOptions, textWidth, unquote, wrapText, type DiagramLines } from './parse';
import styles from './Diagrams.module.css';

export type NodeShape = 'circle' | 'box' | 'round' | 'diamond' | 'db';

export interface GraphNode {
  id: string;
  label: string;
  shape: NodeShape;
  /** Центр узла; у узлов без @ координаты считает раскладка */
  x?: number;
  y?: number;
  lines: string[];
  w: number;
  h: number;
  /** `{color: red}` — обводка */
  color?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  directed: boolean;
  color?: string;
  dashed?: boolean;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: string;
  directed: boolean;
}

const EDGE = /^(.+?)\s*(->|--|<-)\s*(.+?)(?:\s*:\s*(.+))?$/;
const POSITION = /@\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/;

function sizeNode(node: Pick<GraphNode, 'label' | 'shape'>): Pick<GraphNode, 'lines' | 'w' | 'h'> {
  if (node.shape === 'circle') {
    const lines = wrapText(node.label, 18);
    const width = Math.max(...lines.map((line) => textWidth(line)));
    const w = Math.max(36, width + 22);
    return { lines, w, h: Math.max(36, lines.length * 15 + 16) };
  }
  const lines = wrapText(node.label, node.shape === 'diamond' ? 20 : 26);
  const width = Math.max(...lines.map((line) => textWidth(line)));
  const w = Math.max(72, width + 28) * (node.shape === 'diamond' ? 1.45 : 1);
  const h = (lines.length * 15 + 18) * (node.shape === 'diamond' ? 1.7 : 1);
  return { lines, w, h };
}

/**
 * `graph`: узлы `id "Подпись" @ x, y`, рёбра `A -> B : подпись` / `A -- B`, layout: manual|circle|grid|layered.
 * `diagram`: узлы `A: box|round|diamond|db "Текст" @ x, y`, рёбра как у графа, по умолчанию — сверху вниз.
 */
export function parseGraph({ header, body }: DiagramLines, kind: 'graph' | 'diagram'): GraphModel {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const directed = header.variant.includes('directed');
  const defaultShape: NodeShape = kind === 'graph' ? 'circle' : 'box';

  const ensure = (id: string): GraphNode => {
    let node = nodes.get(id);
    if (!node) {
      node = { id, label: id, shape: defaultShape, lines: [], w: 0, h: 0 };
      nodes.set(id, node);
    }
    return node;
  };

  for (const { text: raw, line } of body) {
    // `{color: red, dashed}` в конце строки — цвет и пунктир вершины или ребра (формат сайта группы)
    const { rest: text, options } = takeOptions(raw);
    const color = options.color ? resolveColor(options.color) : undefined;
    // diagram: "A: round "Текст" @ 80, 40"
    const flowNode = /^([^\s:"]+)\s*:\s*(box|round|diamond|db|circle)?\s*(".*?")?\s*(@.*)?$/.exec(text);
    if (kind === 'diagram' && flowNode && !EDGE.test(text.split(':')[0]!)) {
      const node = ensure(flowNode[1]!);
      node.shape = (flowNode[2] as NodeShape) ?? 'box';
      if (flowNode[3]) node.label = unquote(flowNode[3]);
      const at = POSITION.exec(flowNode[4] ?? '');
      if (at) [node.x, node.y] = [Number(at[1]), Number(at[2])];
      if (color) node.color = color;
      continue;
    }

    const edge = EDGE.exec(text);
    if (edge && !text.startsWith('"')) {
      const [from, arrow, to] = [edge[1]!.trim(), edge[2]!, edge[3]!.trim()];
      ensure(from);
      ensure(to);
      edges.push({
        from: arrow === '<-' ? to : from,
        to: arrow === '<-' ? from : to,
        label: edge[4]?.trim() || options.label || undefined,
        directed: arrow !== '--' || directed,
        color,
        dashed: options.dashed,
      });
      continue;
    }

    // graph: "A "Подпись" @ 220, 70" или "a1 @ 120, 60"
    const graphNode = /^([^\s"@]+)\s*(".*?")?\s*(@\s*-?[\d.]+\s*,\s*-?[\d.]+)?$/.exec(text);
    if (graphNode) {
      const node = ensure(graphNode[1]!);
      if (graphNode[2]) node.label = unquote(graphNode[2]);
      const at = POSITION.exec(graphNode[3] ?? '');
      if (at) [node.x, node.y] = [Number(at[1]), Number(at[2])];
      if (color) node.color = color;
      continue;
    }
    throw new Error(`Строка ${line}: непонятная команда`);
  }

  for (const node of nodes.values()) Object.assign(node, sizeNode(node));
  const layout = header.layout ?? (kind === 'diagram' ? 'layered' : [...nodes.values()].every((node) => node.x !== undefined) ? 'manual' : 'circle');
  const model: GraphModel = { nodes: [...nodes.values()], edges, layout, directed };
  if (model.nodes.length === 0) throw new Error('Пустая диаграмма');
  applyLayout(model);
  return model;
}

/** Уровни сверху вниз: самый длинный путь от корней, обратные рёбра циклов не учитываются */
function layers(model: GraphModel): Map<string, number> {
  const index = new Map(model.nodes.map((node, i) => [node.id, i]));
  const outgoing = new Map<string, string[]>();
  for (const edge of model.edges) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);

  // Обратные рёбра — те, что ведут в узел на текущем пути обхода в глубину
  const back = new Set<string>();
  const state = new Map<string, 'open' | 'done'>();
  const visit = (id: string) => {
    state.set(id, 'open');
    for (const next of outgoing.get(id) ?? []) {
      if (state.get(next) === 'open') back.add(`${id}>${next}`);
      else if (!state.has(next)) visit(next);
    }
    state.set(id, 'done');
  };
  const hasIncoming = new Set(model.edges.map((edge) => edge.to));
  for (const node of model.nodes) if (!hasIncoming.has(node.id) && !state.has(node.id)) visit(node.id);
  for (const node of model.nodes) if (!state.has(node.id)) visit(node.id);

  const level = new Map(model.nodes.map((node) => [node.id, 0]));
  for (let pass = 0; pass < model.nodes.length; pass++) {
    for (const edge of model.edges) {
      if (back.has(`${edge.from}>${edge.to}`) || edge.from === edge.to) continue;
      const candidate = level.get(edge.from)! + 1;
      if (candidate > level.get(edge.to)!) level.set(edge.to, candidate);
    }
  }
  return new Map([...level].sort((a, b) => index.get(a[0])! - index.get(b[0])!));
}

function applyLayout(model: GraphModel) {
  const free = model.nodes.filter((node) => node.x === undefined || node.y === undefined);
  if (free.length === 0) return;

  if (model.layout === 'circle' || model.layout === 'force') {
    const radius = Math.max(110, free.length * 22);
    free.forEach((node, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / free.length;
      node.x = 320 + radius * Math.cos(angle);
      node.y = 180 + radius * Math.sin(angle);
    });
    if (model.layout === 'force') relax(model, new Set(free));
    return;
  }

  if (model.layout === 'grid') {
    const columns = Math.ceil(Math.sqrt(free.length));
    free.forEach((node, i) => {
      node.x = 100 + (i % columns) * 160;
      node.y = 50 + Math.floor(i / columns) * 100;
    });
    return;
  }

  // layered (и всё остальное): уровни сверху вниз, внутри уровня — по порядку объявления
  const level = layers(model);
  const rows = new Map<number, GraphNode[]>();
  for (const node of free) rows.set(level.get(node.id)!, [...(rows.get(level.get(node.id)!) ?? []), node]);
  const widest = Math.max(...[...rows.values()].map((row) => row.reduce((sum, node) => sum + node.w, 0) + (row.length - 1) * 48));
  let y = 0;
  for (const depth of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(depth)!;
    const rowHeight = Math.max(...row.map((node) => node.h));
    const rowWidth = row.reduce((sum, node) => sum + node.w, 0) + (row.length - 1) * 48;
    let x = (widest - rowWidth) / 2;
    for (const node of row) {
      node.x = x + node.w / 2;
      node.y = y + rowHeight / 2;
      x += node.w + 48;
    }
    y += rowHeight + 56;
  }
}

/**
 * layout: force — вершины отталкиваются, рёбра стягивают (как на сайте группы). Старт — круг, двигаются только
 * вершины без @. ponytail: O(n²) на шаг, у группы до ~120 вершин — хватает
 */
function relax(model: GraphModel, movable: Set<GraphNode>) {
  const byId = new Map(model.nodes.map((node) => [node.id, node]));
  for (let step = 0; step < 120; step++) {
    for (const node of movable) {
      let [dx, dy] = [0, 0];
      for (const other of model.nodes) {
        if (other === node) continue;
        const [ox, oy] = [node.x! - other.x!, node.y! - other.y!];
        const d2 = Math.max(400, ox * ox + oy * oy);
        dx += (ox / d2) * 6000;
        dy += (oy / d2) * 6000;
      }
      for (const edge of model.edges) {
        const other = edge.from === node.id ? byId.get(edge.to) : edge.to === node.id ? byId.get(edge.from) : undefined;
        if (!other || other === node) continue;
        dx += (other.x! - node.x!) * 0.04;
        dy += (other.y! - node.y!) * 0.04;
      }
      node.x! += Math.max(-20, Math.min(20, dx));
      node.y! += Math.max(-20, Math.min(20, dy));
    }
  }
}

/** Точка на границе узла в направлении (dx, dy) от центра — чтобы стрелка упиралась в край */
function boundary(node: GraphNode, dx: number, dy: number): [number, number] {
  const length = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / length, dy / length];
  if (node.shape === 'circle') {
    const rx = node.w / 2;
    const ry = node.h / 2;
    const t = 1 / Math.sqrt((ux * ux) / (rx * rx) + (uy * uy) / (ry * ry));
    return [node.x! + ux * t, node.y! + uy * t];
  }
  if (node.shape === 'diamond') {
    const t = 1 / (Math.abs(ux) / (node.w / 2) + Math.abs(uy) / (node.h / 2));
    return [node.x! + ux * t, node.y! + uy * t];
  }
  const t = Math.min(node.w / 2 / Math.max(Math.abs(ux), 1e-9), node.h / 2 / Math.max(Math.abs(uy), 1e-9));
  return [node.x! + ux * t, node.y! + uy * t];
}

function NodeShapeView({ node }: { node: GraphNode }) {
  const { x = 0, y = 0, w, h } = node;
  if (!node.color) return shape(node, x, y, w, h);
  return (
    <g className={styles.colored} style={{ '--node-color': node.color } as CSSProperties}>
      {shape(node, x, y, w, h)}
    </g>
  );
}

function shape(node: GraphNode, x: number, y: number, w: number, h: number) {
  switch (node.shape) {
    case 'circle':
      return <ellipse className={styles.node} cx={x} cy={y} rx={w / 2} ry={h / 2} />;
    case 'round':
      return <rect className={styles.nodeAccent} x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} />;
    case 'diamond':
      return <polygon className={styles.nodeWarm} points={`${x},${y - h / 2} ${x + w / 2},${y} ${x},${y + h / 2} ${x - w / 2},${y}`} />;
    case 'db':
      return (
        <g>
          <path
            className={styles.node}
            d={`M${x - w / 2},${y - h / 2 + 6} v${h - 12} a${w / 2},6 0 0 0 ${w},0 v${-(h - 12)} a${w / 2},6 0 0 0 ${-w},0 z`}
          />
          <ellipse className={styles.node} cx={x} cy={y - h / 2 + 6} rx={w / 2} ry={6} />
        </g>
      );
    default:
      return <rect className={styles.node} x={x - w / 2} y={y - h / 2} width={w} height={h} rx={8} />;
  }
}

function EdgeLabel({ x, y, label }: { x: number; y: number; label: string }) {
  const width = textWidth(label, 11) + 10;
  return (
    <g>
      <rect className={styles.edgeLabelBox} x={x - width / 2} y={y - 9} width={width} height={18} rx={5} />
      <text className={styles.edgeLabel} x={x} y={y + 4} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

export function GraphView({ model }: { model: GraphModel }) {
  const markerId = `arrow-${useId().replace(/[^a-z0-9]/gi, '')}`;
  const byId = new Map(model.nodes.map((node) => [node.id, node]));
  const pad = 24;
  const minX = Math.min(...model.nodes.map((node) => node.x! - node.w / 2)) - pad;
  // Над вершиной с петлёй нужно место под дугу
  const loops = new Set(model.edges.filter((edge) => edge.from === edge.to).map((edge) => edge.from));
  const minY = Math.min(...model.nodes.map((node) => node.y! - node.h / 2 - (loops.has(node.id) ? Math.max(16, node.w / 3) * 2.2 : 0))) - pad;
  const maxX = Math.max(...model.nodes.map((node) => node.x! + node.w / 2)) + pad;
  const maxY = Math.max(...model.nodes.map((node) => node.y! + node.h / 2)) + pad;
  const pairs = new Set(model.edges.map((edge) => `${edge.from}>${edge.to}`));

  return (
    <svg
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      className={styles.svg}
      style={{ maxWidth: maxX - minX, minWidth: (maxX - minX) * 0.7 }}
      role="img"
    >
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className={styles.arrowHead} />
        </marker>
      </defs>

      {model.edges.map((edge, index) => {
        const from = byId.get(edge.from)!;
        const to = byId.get(edge.to)!;
        const edgeStyle = { stroke: edge.color, strokeDasharray: edge.dashed ? '5 4' : undefined };
        const marker = edge.directed ? `url(#${markerId})` : undefined;
        if (from === to) {
          // Петля — дуга над вершиной
          const [x, top, r] = [from.x!, from.y! - from.h / 2, Math.max(16, from.w / 3)];
          const d = `M${x + r * 0.6},${top + 2} C${x + r * 2},${top - r * 2.4} ${x - r * 2},${top - r * 2.4} ${x - r * 0.6},${top + 2}`;
          return (
            <g key={index} data-dgm-edge={index}>
              <path className={styles.edgeHit} d={d} />
              <path className={styles.edge} style={edgeStyle} d={d} markerEnd={marker} />
              {edge.label && <EdgeLabel x={x} y={top - r * 1.9} label={edge.label} />}
            </g>
          );
        }
        const dx = to.x! - from.x!;
        const dy = to.y! - from.y!;
        // Повтор того же ребра (A -> B дважды) — своей дугой, а не поверх первого
        const repeat = model.edges.slice(0, index).filter((other) => other.from === edge.from && other.to === edge.to).length;
        // Встречное ребро или «назад вверх» в блок-схеме — дугой, чтобы не лечь на соседнее
        const curved = repeat > 0 || pairs.has(`${edge.to}>${edge.from}`) || (model.layout === 'layered' && dy < -10);
        const length = Math.hypot(dx, dy) || 1;
        const bend = curved ? Math.min(60, length * 0.25) * (pairs.has(`${edge.to}>${edge.from}`) || repeat > 0 ? 1 + repeat : 1.6) : 0;
        const [nx, ny] = [-dy / length, dx / length];
        const cx = (from.x! + to.x!) / 2 + nx * bend;
        const cy = (from.y! + to.y!) / 2 + ny * bend;
        const [x1, y1] = boundary(from, cx - from.x!, cy - from.y!);
        const [x2, y2] = boundary(to, cx - to.x!, cy - to.y!);
        const labelX = curved ? (x1 + 2 * cx + x2) / 4 : (x1 + x2) / 2;
        const labelY = curved ? (y1 + 2 * cy + y2) / 4 : (y1 + y2) / 2;
        const d = curved ? `M${x1},${y1} Q${cx},${cy} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`;
        return (
          // data-dgm-edge / data-dgm-node — по ним конструктор диаграмм узнаёт, что нажали на холсте
          <g key={index} data-dgm-edge={index}>
            <path className={styles.edgeHit} d={d} />
            <path className={styles.edge} style={edgeStyle} d={d} markerEnd={marker} />
            {edge.label && <EdgeLabel x={labelX} y={labelY} label={edge.label} />}
          </g>
        );
      })}

      {model.nodes.map((node) => (
        <g key={node.id} className={styles.nodeGroup} data-dgm-node={node.id}>
          <NodeShapeView node={node} />
          {node.lines.map((line, index) => (
            <text key={index} className={styles.nodeText} x={node.x} y={node.y! + (index - (node.lines.length - 1) / 2) * 15 + 4} textAnchor="middle">
              {line}
            </text>
          ))}
        </g>
      ))}
    </svg>
  );
}
