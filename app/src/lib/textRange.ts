/**
 * Находит в DOM первое место, где встречается текст (например, сохранённая пометка), и возвращает его Range.
 * Пробелы не учитываются: выделение через абзацы или жирный текст даёт другие пробелы, чем в разметке.
 */
export function findTextRange(root: Node, text: string): Range | null {
  const target = text.replace(/\s+/g, '');
  if (!target) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const starts: number[] = [];
  let joined = '';
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    starts.push(joined.length);
    nodes.push(node as Text);
    joined += (node as Text).data;
  }
  // Позиции непробельных символов в общем тексте — по ним ищем без учёта пробелов
  const positions: number[] = [];
  let flat = '';
  for (let index = 0; index < joined.length; index++) {
    if (/\s/.test(joined[index]!)) continue;
    positions.push(index);
    flat += joined[index];
  }
  const at = flat.indexOf(target);
  if (at < 0) return null;

  const locate = (index: number) => {
    let node = 0;
    while (node + 1 < nodes.length && starts[node + 1]! <= index) node++;
    return { node: nodes[node]!, offset: index - starts[node]! };
  };
  const start = locate(positions[at]!);
  const end = locate(positions[at + target.length - 1]!);
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset + 1);
  return range;
}
