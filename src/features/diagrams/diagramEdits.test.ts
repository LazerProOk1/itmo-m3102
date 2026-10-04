import { describe, expect, it } from 'vitest';
import {
  addNode,
  clearPositions,
  connect,
  decodeShare,
  deleteEdge,
  deleteNode,
  encodeShare,
  importGraph,
  moveCanvasShape,
  moveNode,
  readEdge,
  readNode,
  updateEdge,
  updateNode,
} from './diagramEdits';

const GRAPH = 'graph\nA "Старт" {color: red}\nA -> B : 5\nB -- C';

describe('правки текста диаграммы из конструктора', () => {
  it('перенос вершины: позиция в её строке, остальные закрепляются на месте', () => {
    const positions = new Map([
      ['A', { x: 10, y: 20 }],
      ['B', { x: 100, y: 20 }],
      ['C', { x: 200, y: 20 }],
    ]);
    const next = moveNode(GRAPH, 'graph', 'A', { x: 55.4, y: 66 }, positions);
    expect(next).toContain('A "Старт" @ 55, 66 {color: red}');
    expect(next).toContain('B @ 100, 20');
    expect(next).toContain('C @ 200, 20');
    // второй перенос не плодит строки
    expect(moveNode(next, 'graph', 'B', { x: 1, y: 2 }, positions).match(/^B @/gm)).toHaveLength(1);
  });

  it('добавить, соединить, удалить вершину с рёбрами и ребро по номеру', () => {
    expect(addNode(GRAPH, 'graph', { x: 5, y: 6 }, ['A', 'B', 'C'])).toMatch(/\nN1 @ 5, 6$/);
    expect(addNode('diagram', 'diagram', { x: 1, y: 2 }, ['N1'])).toContain('N2: box "Новый блок" @ 1, 2');
    expect(connect(GRAPH, 'C', 'A')).toMatch(/C -- A$/);
    expect(connect('graph directed\nA', 'A', 'B')).toMatch(/A -> B$/);
    expect(deleteNode(GRAPH, 'graph', 'B')).toBe('graph\nA "Старт" {color: red}');
    expect(deleteEdge(GRAPH, 1)).toBe('graph\nA "Старт" {color: red}\nA -> B : 5');
  });

  it('свойства вершины и ребра читаются и пишутся', () => {
    expect(readNode(GRAPH, 'graph', 'A')).toMatchObject({ label: 'Старт', color: 'red' });
    expect(updateNode(GRAPH, 'graph', 'A', { label: 'Начало', color: 'blue' })).toContain('A "Начало" {color: blue}');
    expect(readEdge(GRAPH, 0)).toMatchObject({ from: 'A', to: 'B', label: '5' });
    expect(updateEdge(GRAPH, 0, { label: '7', color: 'green', dashed: true, directed: false })).toContain('A -- B : 7 {color: green, dashed}');
    expect(updateNode('diagram\nX: box "Шаг" @ 10, 20', 'diagram', 'X', { label: 'Иначе', shape: 'diamond' })).toBe(
      'diagram\nX: diamond "Иначе" @ 10, 20',
    );
  });

  it('холст: сдвиг фигуры, у стрелки — оба конца', () => {
    const canvas = 'canvas 400x200\nrect 20 20 120 60 "Вход" fill=#eef\narrow 140 50 -> 220 50';
    const moved = moveCanvasShape(moveCanvasShape(canvas, 0, 10, 5), 1, -10, 10);
    expect(moved).toContain('rect 30 25 120 60 "Вход" fill=#eef');
    expect(moved).toContain('arrow 130 60 -> 210 60');
  });

  it('импорт графа: список рёбер и матрица смежности', () => {
    expect(importGraph('A B 5\nB C', 'edges')).toBe('A -> B : 5\nB -> C');
    expect(importGraph('A B\n0 2\n0 0', 'matrix')).toBe('A -> B : 2');
    expect(() => importGraph('A B\n1', 'matrix')).toThrow('квадратная матрица');
  });

  it('ссылка на диаграмму: текст с кириллицей туда и обратно', () => {
    const source = 'graph\nА -> Б : «вес»';
    expect(decodeShare(encodeShare(source))).toBe(source);
  });
});

describe('авто-раскладка', () => {
  it('убирает ручные позиции, подписи и цвета остаются', () => {
    expect(clearPositions('graph\nA "Старт" @ 10, 20 {color: red}\nB @ 1, 2\nA -> B')).toBe('graph\nA "Старт" {color: red}\nA -> B');
  });
});
