import test from 'node:test';
import assert from 'node:assert/strict';
import { codeFigure, diagramLanguages, parseDiagram, renderDiagram, serializeDiagram } from '../js/diagrams/index.js';
import { parseExpression } from '../js/diagrams/expression.js';
import { importGraphText, plotCoordinates } from '../js/diagrams/editor.js';

test('выражения соблюдают приоритет и не исполняют JavaScript', () => {
  assert.equal(parseExpression('2+3*4')({}), 14);
  assert.equal(parseExpression('2^3^2')({}), 512);
  assert.equal(parseExpression('-2^2')({}), -4);
  assert.equal(parseExpression('2x + 2(x+1)')({ x: 3 }), 14);
  assert.equal(parseExpression('sin(pi/2)')({}), 1);
  assert.throws(() => parseExpression('process.exit()'));
});

const examples = {
  graph: 'graph directed\nlayout: circle\nA -> B : 5\nB -> C : 2 {color: red}\nA @ 120,80',
  plot: 'plot\nx: -5..5 y: -3..3 grid\ny = sin(x)\ny = x^2/4 - 1\npoint (1, 2) "A"',
  chart: 'chart bar\ntitle: Баллы\nДискретка: 78\nАлгебра: 91',
  tree: 'tree\nA\n  B\n  C',
  array: 'array\n[5, 2, 9, 1, 7] i=1 j=3 highlight: 2,3 sorted: 0',
  diagram: 'diagram\nA: round "Вход"\nB: diamond "Условие"\nA -> B',
  canvas: 'canvas 400x200\nrect 20 20 120 60 "Вход" fill=#eef\narrow 140 50 -> 220 50\ncircle 260 50 r=30 "q0"',
};

test('все обязательные языки рендерятся и проходят round-trip', () => {
  assert.deepEqual(diagramLanguages().sort(), Object.keys(examples).sort());
  for (const [lang, source] of Object.entries(examples)) {
    const model = parseDiagram(lang, source);
    const canonical = value => JSON.stringify(value, (_, item) => item instanceof Map ? [...item] : typeof item === 'function' ? '[function]' : item);
    assert.equal(canonical(parseDiagram(lang, serializeDiagram(model))), canonical(model));
    const rendered = renderDiagram(lang, source).svg;
    assert.match(rendered, /^<svg /);
    assert.equal(renderDiagram(lang, source).svg, rendered);
    assert.match(rendered, /<title>/);
  }
});

test('подписи экранируются, ошибки содержат строку', () => {
  const figure = codeFigure('canvas', 'canvas 400x200\ntext 20 30 "<script>alert(1)</script>"');
  assert.doesNotMatch(figure, /<script>/);
  assert.match(figure, /&lt;script&gt;/);
  assert.match(codeFigure('graph', 'graph\nA -> B\nA => B'), /Строка 3/);
});

test('параметрический график, касательная и несколько серий', () => {
  const plot = renderDiagram('plot', 'plot\nx: -2..2 y: -2..2 grid\n(cos(t), sin(t)) t: 0..2*pi\ntangent y = x^2 at 1').svg;
  assert.match(plot, /clipPath/);
  const chart = renderDiagram('chart', 'chart bar\nseries: Тест | Экзамен\nДМ | 70 | 85\nАлгебра | 66 | 90').svg;
  assert.match(chart, /Экзамен/);
});

test('группа холста и ошибка незакрытой группы', () => {
  const image = renderDiagram('canvas', 'canvas 400x200\ngroup 20 30\nrect 10 10 100 40 "A"\nendgroup').svg;
  assert.match(image, /x="30" y="40"/);
  assert.throws(() => parseDiagram('canvas', 'canvas 400x200\ngroup 20 30'), /Не закрыта группа/);
});

test('импорт графа из рёбер и матрицы', () => {
  assert.equal(importGraphText('A B 5\nB C 2'), 'A -> B : 5\nB -> C : 2');
  assert.equal(importGraphText('A B\n0 3\n0 0', 'matrix'), 'A -> B : 3');
  assert.throws(() => importGraphText('A B\n0 1', 'matrix'), /квадратная/);
});

test('точка холста переводится в координаты графика', () => {
  assert.deepEqual(plotCoordinates({ x: 320, y: 180 }, { x: [-5, 5], y: [-3, 3] }), { x: 0, y: 0 });
});
