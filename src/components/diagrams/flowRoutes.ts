import type { GraphModel } from './Graph';

/*
 * Стрелки блок-схемы — перенос routeFlow из js/diagrams/index.js RedstoneLord (коммит 375f12e).
 * Прямая между центрами пересекает чужие блоки и прячет подписи, поэтому:
 * 1) если плавная S-кривая между нижним и верхним портами никого не задевает — она;
 * 2) иначе стрелка выходит сбоку, идёт по «дорожке» за пределами блоков и входит в цель сверху
 *    (обратные и горизонтальные — в боковой порт); дорожки разных стрелок разнесены на 14 px;
 * 3) входы в широкий блок разводятся по его верхней грани, чтобы стрелки не сливались;
 * 4) подпись — рядом с линией, где нет блоков, линий и других подписей.
 */

type Point = [number, number];

interface Box {
  id: string;
  shape: string;
  x: number;
  y: number;
  w: number;
  h: number;
  l: number;
  r: number;
  t: number;
  b: number;
}

export interface FlowRoute {
  d: string;
  pts: Point[];
}

interface Lane {
  side: 'l' | 'r';
  x: number;
  y0: number;
  y1: number;
}

interface Edge {
  index: number;
  a: Box;
  b: Box;
  kind?: 'loop' | 'direct' | 'lane' | 'side' | 'row';
  dir?: number;
  s?: 'l' | 'r';
  px?: number;
  ya?: number;
  yb?: number;
  lane?: number;
  pa?: number;
  pb?: number;
  arr?: number;
  route?: FlowRoute;
}

const TIP = 2;
const LEAD = 30;
const MARGIN = 26;
const f = (n: number) => String(Math.round(n * 10) / 10);

const dense = (pts: Point[], step = 6): Point[] => {
  const out: Point[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    const k = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let j = 1; j <= k; j++) out.push([x0 + ((x1 - x0) * j) / k, y0 + ((y1 - y0) * j) / k]);
  }
  return out;
};

const bezier = (p0: Point, p1: Point, p2: Point, p3: Point, n = 32): Point[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    const at = (k: 0 | 1) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k];
    return [at(0), at(1)] as Point;
  });

/** Ломаная со скруглёнными углами: углы — квадратичные кривые, последний отрезок прямой под наконечник */
function rounded(raw: Point[], r = 14): FlowRoute {
  const unique = raw.filter((p, i) => !i || Math.hypot(p[0] - raw[i - 1]![0], p[1] - raw[i - 1]![1]) > 0.5);
  const q = unique.filter((p, i, all) => {
    if (!i || i === all.length - 1) return true;
    const [px, py] = all[i - 1]!;
    const [nx, ny] = all[i + 1]!;
    return Math.abs((p[0] - px) * (ny - p[1]) - (p[1] - py) * (nx - p[0])) > 0.5;
  });
  let d = `M${f(q[0]![0])} ${f(q[0]![1])}`;
  for (let i = 1; i < q.length - 1; i++) {
    const [px, py] = q[i - 1]!;
    const [x, y] = q[i]!;
    const [nx, ny] = q[i + 1]!;
    const l1 = Math.hypot(x - px, y - py);
    const l2 = Math.hypot(nx - x, ny - y);
    const k = Math.min(r, l1 / 2, l2 / 2);
    d += `L${f(x + ((px - x) / l1) * k)} ${f(y + ((py - y) / l1) * k)}Q${f(x)} ${f(y)} ${f(x + ((nx - x) / l2) * k)} ${f(y + ((ny - y) / l2) * k)}`;
  }
  const last = q[q.length - 1]!;
  return { d: `${d}L${f(last[0])} ${f(last[1])}`, pts: dense(q, 4) };
}

const curve = ([p0, p1, p2, p3]: Point[]): FlowRoute => ({
  d: `M${f(p0![0])} ${f(p0![1])}C${f(p1![0])} ${f(p1![1])} ${f(p2![0])} ${f(p2![1])} ${f(p3![0])} ${f(p3![1])}`,
  pts: dense(bezier(p0!, p1!, p2!, p3!), 4),
});

/**
 * Маршруты всех рёбер блок-схемы и места подписей (null — подписи нет).
 * labelSize — ширина и высота плашки подписи по тексту.
 */
export function routeFlow(
  model: Pick<GraphModel, 'nodes' | 'edges'>,
  labelSize: (text: string) => [number, number],
): { routes: FlowRoute[]; labels: (Point | null)[] } {
  const boxes = new Map<string, Box>(
    model.nodes.map((node) => {
      const [x, y] = [node.x ?? 0, node.y ?? 0];
      return [
        node.id,
        { id: node.id, shape: node.shape, x, y, w: node.w, h: node.h, l: x - node.w / 2, r: x + node.w / 2, t: y - node.h / 2, b: y + node.h / 2 },
      ];
    }),
  );
  const all = [...boxes.values()];
  const others = (skip: string[]) => all.filter((n) => !skip.includes(n.id));
  const inside = (n: Box, x: number, y: number, m: number) =>
    n.shape === 'diamond'
      ? Math.abs(x - n.x) / (n.w / 2 + m) + Math.abs(y - n.y) / (n.h / 2 + m) < 1
      : n.shape === 'circle'
        ? Math.hypot(x - n.x, y - n.y) < n.w / 2 + m
        : x > n.l - m && x < n.r + m && y > n.t - m && y < n.b + m;
  const hits = (pts: Point[], skip: string[], m = 8) => others(skip).some((n) => pts.some(([x, y]) => inside(n, x, y, m)));
  const lanes: Lane[] = [];
  const vcurve = (a: Box, b: Box, dir: number, x1 = b.x): Point[] => {
    const y0 = dir > 0 ? a.b : a.t;
    const y1 = dir > 0 ? b.t : b.b;
    const my = (y0 + y1) / 2;
    return [
      [a.x, y0],
      [a.x, my],
      [x1, my],
      [x1, y1],
    ];
  };
  const hcurve = (a: Box, b: Box): Point[] => {
    const right = b.x > a.x;
    const x0 = right ? a.r : a.l;
    const x1 = right ? b.l : b.r;
    const mx = (x0 + x1) / 2;
    return [
      [x0, a.y],
      [mx, a.y],
      [mx, b.y],
      [x1, b.y],
    ];
  };
  const allocLane = (side: 'l' | 'r', base: number, y0: number, y1: number) => {
    const sign = side === 'r' ? 1 : -1;
    let x = base;
    while (lanes.some((lane) => lane.side === side && Math.abs(lane.x - x) < 13 && lane.y0 < y1 && lane.y1 > y0)) x += sign * 14;
    lanes.push({ side, x, y0, y1 });
    return x;
  };
  const laneBase = (side: 'l' | 'r', from: number, obstacles: Box[]) =>
    side === 'r' ? Math.max(from, ...obstacles.map((n) => n.r)) + MARGIN : Math.min(from, ...obstacles.map((n) => n.l)) - MARGIN;

  const edges: Edge[] = model.edges.map((edge, index) => ({ index, a: boxes.get(edge.from)!, b: boxes.get(edge.to)! }));

  // 1. Тип маршрута
  for (const e of edges) {
    const { a, b } = e;
    const skip = [a.id, b.id];
    if (a === b) e.kind = 'loop';
    else if (b.t >= a.b + 12) {
      e.dir = 1;
      e.kind = hits(bezier(...(vcurve(a, b, 1) as [Point, Point, Point, Point])), skip) ? 'lane' : 'direct';
    } else if (b.b <= a.t - 12) {
      e.dir = -1;
      e.kind = hits(bezier(...(vcurve(a, b, -1) as [Point, Point, Point, Point])), skip) ? 'side' : 'direct';
    } else if (a.r + 24 <= b.l || b.r + 24 <= a.l) e.kind = hits(bezier(...(hcurve(a, b) as [Point, Point, Point, Point])), skip) ? 'side' : 'row';
    else e.kind = 'side';
  }

  // 2. Дорожки: сначала стрелки из нижних блоков — они занимают внутренние дорожки, верхние идут снаружи
  for (const e of [...edges].sort((p, q) => q.a.y - p.a.y)) {
    const { a, b } = e;
    const skip = [a.id, b.id];
    if (e.kind === 'lane') {
      const yb = Math.max(a.y + 14, b.t - LEAD);
      const sides = (['r', 'l'] as const)
        .map((s) => {
          const px = s === 'r' ? a.r : a.l;
          const base = laneBase(
            s,
            px,
            others(skip).filter((n) => n.t < yb && n.b > a.y),
          );
          return {
            s,
            px,
            base,
            cost: Math.abs(base - px) + Math.abs(base - b.x),
            ok: !hits(
              dense([
                [px, a.y],
                [base, a.y],
              ]),
              skip,
              4,
            ),
          };
        })
        .filter((option) => option.ok)
        .sort((p, q) => p.cost - q.cost);
      if (sides.length) {
        const o = sides[0]!;
        Object.assign(e, { s: o.s, px: o.px, yb, lane: allocLane(o.s, o.base, a.y, yb) });
      } else {
        const ya = a.b + Math.min(18, (b.t - a.b) / 3);
        const o = (['r', 'l'] as const)
          .map((s) => {
            const base = laneBase(
              s,
              a.x,
              others(skip).filter((n) => n.t < yb && n.b > ya),
            );
            return { s, base, cost: Math.abs(base - a.x) + Math.abs(base - b.x) };
          })
          .sort((p, q) => p.cost - q.cost)[0]!;
        Object.assign(e, { s: o.s, ya, yb, lane: allocLane(o.s, o.base, ya, yb) });
      }
    } else if (e.kind === 'side') {
      const y0 = Math.min(a.y, b.y);
      const y1 = Math.max(a.y, b.y);
      const obstacles = others(skip).filter((n) => n.t < y1 && n.b > y0);
      const options = (['r', 'l'] as const).map((s) => {
        const base = laneBase(s, s === 'r' ? Math.max(a.r, b.r) : Math.min(a.l, b.l), obstacles);
        const pa = s === 'r' ? a.r : a.l;
        const pb = s === 'r' ? b.r : b.l;
        return {
          s,
          base,
          pa,
          pb,
          cost: Math.abs(base - pa) + Math.abs(base - pb),
          ok:
            !hits(
              dense([
                [pa, a.y],
                [base, a.y],
              ]),
              skip,
              4,
            ) &&
            !hits(
              dense([
                [base, b.y],
                [pb, b.y],
              ]),
              skip,
              4,
            ),
        };
      });
      const ok = options.filter((option) => option.ok);
      const o = (ok.length ? ok : options).sort((p, q) => p.cost - q.cost)[0]!;
      Object.assign(e, { s: o.s, pa: o.pa, pb: o.pb, lane: allocLane(o.s, o.base, y0, y1) });
    }
  }

  // 3. Точки входа сверху/снизу: у ромба и круга — вершина, у прямоугольных блоков входы разводятся по грани
  const groups = new Map<string, { e: Edge; ax: number }[]>();
  for (const e of edges) {
    if (e.kind !== 'direct' && e.kind !== 'lane') continue;
    const key = `${e.b.id}:${(e.dir ?? 1) > 0 ? 't' : 'b'}`;
    const list = groups.get(key) ?? [];
    list.push({ e, ax: e.kind === 'lane' ? e.lane! : e.a.x });
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    const b = list[0]!.e.b;
    const lo = b.l + 14;
    const hi = b.r - 14;
    const step = 14;
    if (b.shape === 'diamond' || b.shape === 'circle' || hi <= lo) {
      list.forEach((item) => (item.e.arr = b.x));
      continue;
    }
    list.sort((p, q) => p.ax - q.ax);
    let xs = list.map((item) => Math.max(lo, Math.min(hi, item.ax)));
    for (let i = 1; i < xs.length; i++) xs[i] = Math.max(xs[i]!, xs[i - 1]! + step);
    for (let i = xs.length - 1; i >= 0; i--) xs[i] = Math.min(xs[i]!, hi - (xs.length - 1 - i) * step);
    if (xs[0]! < lo) xs = xs.map((_, i) => (xs.length === 1 ? b.x : lo + ((hi - lo) * i) / (xs.length - 1)));
    list.forEach((item, i) => (item.e.arr = xs[i]));
  }

  // 4. Геометрия
  for (const e of edges) {
    const { a, b } = e;
    if (e.kind === 'loop') {
      e.route = rounded([
        [a.r, a.y],
        [a.r + 30, a.y],
        [a.r + 30, a.t - 18],
        [a.x, a.t - 18],
        [a.x, a.t - TIP],
      ]);
    } else if (e.kind === 'direct') {
      const points = vcurve(a, b, e.dir!, e.arr);
      points[3]![1] -= e.dir! * TIP;
      e.route = curve(points);
    } else if (e.kind === 'row') {
      const points = hcurve(a, b);
      points[3]![0] += b.x > a.x ? -TIP : TIP;
      e.route = curve(points);
    } else if (e.kind === 'lane') {
      e.route = rounded(
        e.ya === undefined
          ? [
              [e.px!, a.y],
              [e.lane!, a.y],
              [e.lane!, e.yb!],
              [e.arr!, e.yb!],
              [e.arr!, b.t - TIP],
            ]
          : [
              [a.x, a.b],
              [a.x, e.ya],
              [e.lane!, e.ya],
              [e.lane!, e.yb!],
              [e.arr!, e.yb!],
              [e.arr!, b.t - TIP],
            ],
      );
    } else {
      e.route = rounded([
        [e.pa!, a.y],
        [e.lane!, a.y],
        [e.lane!, b.y],
        [e.pb! + (e.s === 'r' ? TIP : -TIP), b.y],
      ]);
    }
  }

  // 5. Подписи: у начала линии ищем место рядом с ней без блоков, других линий и подписей
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const labels = edges.map((e): Point | null => {
    const text = String(model.edges[e.index]!.label ?? '').trim();
    if (!text) return null;
    const [lw, lh] = labelSize(text);
    const pts = e.route!.pts;
    const cumulative = [0];
    for (let i = 1; i < pts.length; i++) cumulative.push(cumulative[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
    const total = cumulative[cumulative.length - 1]!;
    const wanted: number[] = [];
    for (let s = 16; s <= Math.min(total * 0.85, 140); s += 8) wanted.push(s);
    if (!wanted.length) wanted.push(total / 2);
    let best: { score: number; rect: (typeof placed)[number]; cx: number; cy: number } | null = null;
    for (const s of wanted) {
      const i = Math.max(
        1,
        Math.min(
          pts.length - 2,
          cumulative.findIndex((c) => c >= s),
        ),
      );
      const [px, py] = pts[i]!;
      const tx = pts[i + 1]![0] - pts[i - 1]![0];
      const ty = pts[i + 1]![1] - pts[i - 1]![1];
      const length = Math.hypot(tx, ty) || 1;
      for (const side of [1, -1]) {
        const nx = (-ty / length) * side;
        const ny = (tx / length) * side;
        const offset = (Math.abs(nx) * lw) / 2 + (Math.abs(ny) * lh) / 2 + 5;
        const cx = px + nx * offset;
        const cy = py + ny * offset;
        const rect = { x0: cx - lw / 2, y0: cy - lh / 2, x1: cx + lw / 2, y1: cy + lh / 2 };
        let score = s * 0.4 + (side < 0 ? 0.2 : 0);
        for (let gx = 0; gx <= 4; gx++)
          for (let gy = 0; gy <= 2; gy++) {
            const x = rect.x0 + ((rect.x1 - rect.x0) * gx) / 4;
            const y = rect.y0 + ((rect.y1 - rect.y0) * gy) / 2;
            if (all.some((n) => inside(n, x, y, 2))) score += 1000;
          }
        for (const other of edges)
          score += Math.min(
            60,
            8 * other.route!.pts.filter(([x, y]) => x > rect.x0 - 2 && x < rect.x1 + 2 && y > rect.y0 - 2 && y < rect.y1 + 2).length,
          );
        for (const q of placed) if (rect.x0 < q.x1 + 2 && rect.x1 > q.x0 - 2 && rect.y0 < q.y1 + 2 && rect.y1 > q.y0 - 2) score += 500;
        if (!best || score < best.score) best = { score, rect, cx, cy };
      }
    }
    placed.push(best!.rect);
    return [best!.cx, best!.cy];
  });

  return { routes: edges.map((e) => e.route!), labels };
}
