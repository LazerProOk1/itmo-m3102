import type { DiagramLanguage } from '../../components/diagrams/DiagramBlock';

/** Типы конструктора и стартовые шаблоны — синтаксис из README репозитория группы */
export const DIAGRAM_TYPES: { value: DiagramLanguage; label: string; hint: string; template: string }[] = [
  {
    value: 'plot',
    label: 'График',
    hint: 'x/y — диапазоны осей, grid — сетка. Кривые: y = …, x = …, параметрические. Опции в {…}: color, label, dashed.',
    template: `title: Рост функций
x: 1..8 y: 0..40 grid
y = x {color: blue, label: "n"}
y = x*log2(x) {color: purple, label: "n log n"}
y = x^2 {color: red, label: "n^2"}`,
  },
  {
    value: 'graph',
    label: 'Граф',
    hint: 'Рёбра: A -> B (ориентированное) или A -- B, вес после двоеточия. layout: circle | grid | layered.',
    template: `title: Граф
layout: circle
A -> B : 5
B -> C : 2
C -> A
C -> D : 7`,
  },
  {
    value: 'diagram',
    label: 'Блок-схема',
    hint: 'Узлы: id: форма "текст" (round, box, diamond). Стрелки: A -> B : подпись.',
    template: `title: Блок-схема
A: round "Старт"
B: diamond "n > 1?"
C: box "n = n - 1"
D: round "Конец"
A -> B
B -> C : Да
C -> B
B -> D : Нет`,
  },
  {
    value: 'tree',
    label: 'Дерево',
    hint: 'Каждый уровень — отступ в два пробела.',
    template: `title: Дерево слияний
[0; 7)
  [0; 4)
    [0; 2)
    [2; 4)
  [4; 7)
    [4; 6)
    [6; 7)`,
  },
  {
    value: 'array',
    label: 'Массив',
    hint: 'Массив в квадратных скобках; highlight:, sorted: — подсветка. После code: — программа, она выполняется по шагам: let/for/while/if, функции, swap(a, i, j), done(i), say("текст"). pointers: i, j — стрелки над ячейками, buffers: buf — доп. массив, print: last — кадр для печати, hidecode — скрыть код.',
    template: `title: Сортировка пузырьком
[5, 2, 9, 1, 7]
pointers: i, j
code:
for (let i = 0; i < a.length - 1; i++) {
  for (let j = 0; j < a.length - 1 - i; j++) {
    if (a[j] > a[j + 1]) {
      swap(a, j, j + 1);
    }
  }
  done(a.length - 1 - i);
}`,
  },
  {
    value: 'chart',
    label: 'Диаграмма данных',
    hint: 'chart bar | line | pie | scatter. series: — названия рядов, дальше строки «подпись | число | …».',
    template: `chart bar
title: Баллы за курс
series: Тест | Экзамен
ДМ | 78 | 91
Линал | 72 | 88
Матан | 64 | 80`,
  },
  {
    value: 'canvas',
    label: 'Холст',
    hint: 'canvas ШxВ. Фигуры по координатам: rect x y w h "текст", circle x y r=30, ellipse x y rx ry, line/arrow x1 y1 -> x2 y2, text x y "…", path M…; fill=цвет; group dx dy … endgroup.',
    template: `canvas 420x200
title: Конечный автомат
circle 80 100 r=32 "q0"
arrow 112 100 -> 228 100
circle 260 100 r=32 "q1" fill=green
text 150 88 "a"
rect 320 70 80 60 "Выход" fill=orange`,
  },
];
