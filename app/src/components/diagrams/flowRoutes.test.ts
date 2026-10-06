import { expect, it } from 'vitest';
import type { GraphModel } from './Graph';
import { routeFlow } from './flowRoutes';

const node = (id: string, x: number, y: number, shape: GraphModel['nodes'][number]['shape'] = 'box') => ({
  id,
  label: id,
  shape,
  x,
  y,
  w: 120,
  h: 40,
  lines: [id],
});

it('стрелка блок-схемы обходит блок на пути, подпись не ложится на блоки', () => {
  // A сверху, B посередине на той же вертикали, C снизу: A -> C напрямую прошла бы сквозь B
  const nodes = [node('A', 200, 40), node('B', 200, 140), node('C', 200, 240)];
  const model = { nodes, edges: [{ from: 'A', to: 'C', directed: true, label: 'да' }] };
  const { routes, labels } = routeFlow(model, () => [30, 18]);
  const b = nodes[1]!;
  const insideB = routes[0]!.pts.some(([x, y]) => x > b.x - b.w / 2 && x < b.x + b.w / 2 && y > b.y - b.h / 2 && y < b.y + b.h / 2);
  expect(insideB).toBe(false);
  // Конец — у верхней грани C
  const end = routes[0]!.pts[routes[0]!.pts.length - 1]!;
  expect(Math.abs(end[1] - (240 - 20))).toBeLessThan(4);
  const [lx, ly] = labels[0]!;
  expect(nodes.some((n) => Math.abs(lx - n.x) < n.w / 2 && Math.abs(ly - n.y) < n.h / 2)).toBe(false);
});

it('свободный путь — плавная кривая сверху вниз, петля — своей дорожкой', () => {
  const nodes = [node('A', 100, 40), node('B', 300, 160, 'diamond')];
  const { routes } = routeFlow(
    {
      nodes,
      edges: [
        { from: 'A', to: 'B', directed: true },
        { from: 'B', to: 'B', directed: true },
      ],
    },
    () => [30, 18],
  );
  expect(routes[0]!.d).toContain('C');
  expect(routes[1]!.d.startsWith('M')).toBe(true);
});
