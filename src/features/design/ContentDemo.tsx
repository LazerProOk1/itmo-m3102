import { Markdown } from '../../components/markdown/Markdown';
import { Section } from '../../components/ui/Section';
import { Demo } from './Demo';

const CALLOUTS = `> [!meaning] Определение
> **Предикат** — функция $P: D^k \\to \\{0, 1\\}$.

> [!remember] Запомнить
> $\\overline{A \\cup B} = \\overline{A} \\cap \\overline{B}$

> [!example] Пример
> $P(x) \\equiv x > 3$, тогда $P(5) = 1$.

> [!warning] Важно
> Пустое множество — подмножество любого множества.

> [!formula]
> $$T(n) = aT(n/b) + f(n)$$

> [!note] Заметка
> Код подсвечивается:

\`\`\`cpp
int main() { return 0; }
\`\`\``;

const DIAGRAMS = `\`\`\`plot
title: Рост функций
x: 1..8 y: 0..40 grid
y = x {color: blue, label: "n"}
y = x*log2(x) {color: purple, label: "n log n"}
y = x^2 {color: red, label: "n^2"}
\`\`\`

\`\`\`diagram
title: Блок-схема
A: round "Старт"
B: diamond "Условие?"
C: box "Действие"
A -> B
B -> C : Да
B -> A : Нет
\`\`\`

\`\`\`tree
title: Дерево
СЛАУ
  Совместная
    Определённая
    Неопределённая
  Несовместная
\`\`\`

\`\`\`array
title: Массив
[8, 3, 7, 1, 9] highlight: 1,3
\`\`\`

\`\`\`graph
title: Граф
layout: circle
A -> B : 5
B -> C : 2
C -> A
\`\`\`

\`\`\`chart
chart bar
title: Баллы
series: Тест | Экзамен
ДМ | 78 | 91
Линал | 72 | 88
\`\`\``;

/** Контент конспектов: выноски, код, формулы и диаграммы DSL группы. */
export function ContentDemo() {
  return (
    <Section title="Конспекты">
      <Demo label="Выноски > [!тип] · типы и цвета как на сайте группы">
        <Markdown content={CALLOUTS} />
      </Demo>
      <Demo label="Диаграммы · ```plot, diagram, tree, array, graph, chart">
        <Markdown content={DIAGRAMS} />
      </Demo>
    </Section>
  );
}
