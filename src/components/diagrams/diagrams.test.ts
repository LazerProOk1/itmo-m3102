import { describe, expect, it } from 'vitest';
import { parseGraph } from './Graph';
import { niceStep, parsePlot } from './Plot';
import { splitLines, takeOptions } from './parse';
import { parseArray, parseChart, parseTree } from './TreeArrayChart';

describe('диаграммы DSL группы', () => {
  it('опции линии', () => {
    expect(takeOptions('y = 4*x {color: red, dashed, label: "c·g(n) = 4n"}')).toEqual({
      rest: 'y = 4*x',
      options: { color: 'red', dashed: true, label: 'c·g(n) = 4n' },
    });
  });

  it('plot: оси, функции, параметрика, точки, области', () => {
    const model = parsePlot(
      splitLines(
        'title: Пример\nx: -2.6..2.6 y: -1.5..1.5 grid\ny = x^2 {color: blue}\n(cos(t), sin(t)) t: 0..6.2832\npoint (1, 0) "k = 0"\narea between y=1 and y=0 from 0 to 1\nx = 1 {dashed}',
        'plot',
      ),
    );
    expect(model.x).toEqual([-2.6, 2.6]);
    expect(model.grid).toBe(true);
    expect(model.items.map((item) => item.kind)).toEqual(['function', 'parametric', 'point', 'area', 'vline']);
  });

  it('шаг делений «красивый»', () => {
    expect(niceStep(800)).toBe(100);
    expect(niceStep(600000)).toBe(100000);
    expect(niceStep(3)).toBe(0.5);
    // Шкала столбчатой диаграммы «Баллы» (до 91): деления 0, 20, … 100, а не 45.5 и 91
    expect(niceStep(91, 4)).toBe(20);
  });

  it('diagram: узлы с формой и ручными координатами, рёбра с подписями', () => {
    const model = parseGraph(splitLines('A: round "Вход: массив" @ 80, 40\nB: diamond "x?"\nA -> B : Да', 'diagram'), 'diagram');
    expect(model.nodes.map((node) => `${node.id}:${node.shape}:${node.label}`)).toEqual(['A:round:Вход: массив', 'B:diamond:x?']);
    expect(model.nodes[0]!.x).toBe(80);
    expect(model.edges[0]).toEqual({ from: 'A', to: 'B', label: 'Да', directed: true });
    expect(model.nodes[1]!.y).toBeDefined();
  });

  it('graph: неориентированные рёбра и ручная раскладка', () => {
    const model = parseGraph(splitLines('layout: manual\nn1 "1" @ 320, 300\nn2 "2"\nn2 @ 320, 220\nn1 -- n2', 'graph'), 'graph');
    expect(model.edges[0]!.directed).toBe(false);
    expect(model.nodes.find((node) => node.id === 'n2')).toMatchObject({ label: '2', x: 320, y: 220 });
  });

  it('tree по отступам', () => {
    const tree = parseTree(splitLines('СЛАУ\n  Совместная\n    Определённая\n  Несовместная', 'tree'));
    expect(tree.label).toBe('СЛАУ');
    expect(tree.children.map((child) => child.children.length)).toEqual([1, 0]);
  });

  it('array: значения, подсветка, код не выполняется', () => {
    const source = 'title: Маска\n["H","e"," "] highlight: 0,1\ncode:\nswap(a, 0, 1);';
    const model = parseArray(splitLines(source, 'array'), source);
    expect(model.values).toEqual(['H', 'e', ' ']);
    expect([...model.highlight]).toEqual([0, 1]);
    expect(model.code).toBe('swap(a, 0, 1);');
  });

  it('chart: оба формата строк', () => {
    expect(parseChart(splitLines('chart bar\nseries: Тест | Экзамен\nДМ | 78 | 91', 'chart')).rows).toEqual([{ label: 'ДМ', values: [78, 91] }]);
    const powers = parseChart(splitLines('x: n = 1..3\nseries: Число\nn=1: 2\nn=2: 4', 'chart'));
    expect(powers.rows).toEqual([
      { label: 'n=1', values: [2] },
      { label: 'n=2', values: [4] },
    ]);
  });
});
