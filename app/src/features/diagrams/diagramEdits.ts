/**
 * Правки исходного текста диаграммы из визуального конструктора: каждое действие на холсте (перетащить,
 * добавить, соединить, удалить, поменять подпись) — это правка строк текста. Текст остаётся источником правды:
 * что видно на холсте, то и уйдёт в конспект. Чистые функции — проверены в diagramEdits.test.ts.
 */

const EDGE = /^\s*(\S+?)\s*(->|--|<-)\s*(\S+?)(?:\s*:\s*(.*?))?\s*(\{[^{}]*\})?\s*$/;
const OPTIONS = /\s*\{[^{}]*\}\s*$/;
const POSITION = /\s*@\s*-?[\d.]+\s*,\s*-?[\d.]+/;
const HEADER = /^\s*(graph|diagram|title|caption|width|height|layout)\b/;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type Point = { x: number; y: number };

/** Номера строк с рёбрами — по порядку, как их видит парсер (index ребра на холсте = индекс здесь) */
function edgeLines(lines: string[]): number[] {
  return lines.flatMap((line, index) =>
    !HEADER.test(line) && !line.trim().startsWith('"') && EDGE.test(line.replace(/^\s*\S+?:\s.*$/, '')) ? [index] : [],
  );
}

const isEdgeLine = (line: string) => EDGE.test(line) && !HEADER.test(line);

/** Строка объявления вершины: graph — `A "Подпись" @ x, y`, diagram — `A: box "Текст"` */
function nodeLine(lines: string[], lang: 'graph' | 'diagram', id: string): number {
  const pattern = lang === 'diagram' ? new RegExp(`^\\s*${escape(id)}\\s*:`) : new RegExp(`^\\s*${escape(id)}(?:\\s|"|@|\\{|$)`);
  return lines.findIndex((line) => pattern.test(line) && !isEdgeLine(line));
}

/** Поставить `@ x, y` в строку вершины (опции {…} остаются в конце) или дописать строку `A @ x, y` */
function withPosition(lines: string[], lang: 'graph' | 'diagram', id: string, point: Point) {
  const at = nodeLine(lines, lang, id);
  const position = ` @ ${Math.round(point.x)}, ${Math.round(point.y)}`;
  if (at === -1) {
    lines.push(lang === 'diagram' ? `${id}: box "${id}"${position}` : `${id}${position}`);
    return;
  }
  const options = OPTIONS.exec(lines[at]!)?.[0] ?? '';
  const base = lines[at]!.slice(0, lines[at]!.length - options.length)
    .replace(POSITION, '')
    .trimEnd();
  lines[at] = `${base}${position}${options ? ` ${options.trim()}` : ''}`;
}

/**
 * Перетащили вершину. Остальные закрепляются там, где стоят сейчас (positions — из раскладки): иначе
 * при первом же переносе автоматическая раскладка переставила бы всю схему.
 */
export function moveNode(source: string, lang: 'graph' | 'diagram', id: string, point: Point, positions: Map<string, Point>): string {
  const lines = source.split('\n');
  for (const [other, at] of positions) {
    const line = nodeLine(lines, lang, other);
    if (other !== id && (line === -1 || !POSITION.test(lines[line]!))) withPosition(lines, lang, other, at);
  }
  withPosition(lines, lang, id, point);
  return lines.join('\n');
}

/** Свободное имя новой вершины: N1, N2… */
export function nextNodeId(existing: Iterable<string>): string {
  const taken = new Set(existing);
  let index = 1;
  while (taken.has(`N${index}`)) index++;
  return `N${index}`;
}

export function addNode(source: string, lang: 'graph' | 'diagram' | 'canvas', point: Point, existing: Iterable<string>): string {
  const [x, y] = [Math.round(point.x), Math.round(point.y)];
  const id = nextNodeId(existing);
  const line =
    lang === 'diagram' ? `${id}: box "Новый блок" @ ${x}, ${y}` : lang === 'canvas' ? `rect ${x - 50} ${y - 28} 100 56 "Блок"` : `${id} @ ${x}, ${y}`;
  return `${source.trimEnd()}\n${line}`;
}

/** Соединить: в неориентированном графе — `A -- B`, иначе стрелка */
export function connect(source: string, from: string, to: string): string {
  const undirected = /^\s*graph\b(?!.*directed)/m.test(source) && !/^\s*diagram\b/m.test(source);
  return `${source.trimEnd()}\n${from} ${undirected ? '--' : '->'} ${to}`;
}

/** Удалить вершину вместе с её рёбрами */
export function deleteNode(source: string, lang: 'graph' | 'diagram', id: string): string {
  const lines = source.split('\n');
  const own = nodeLine(lines, lang, id);
  return lines
    .filter((line, index) => {
      if (index === own) return false;
      const edge = isEdgeLine(line) ? EDGE.exec(line) : null;
      return !(edge && (edge[1] === id || edge[3] === id));
    })
    .join('\n');
}

export function deleteEdge(source: string, index: number): string {
  const lines = source.split('\n');
  const at = edgeLines(lines)[index];
  if (at === undefined) return source;
  lines.splice(at, 1);
  return lines.join('\n');
}

const optionsText = (color: string | undefined, dashed?: boolean) => {
  const parts = [...(color ? [`color: ${color}`] : []), ...(dashed ? ['dashed'] : [])];
  return parts.length ? ` {${parts.join(', ')}}` : '';
};

const readOptions = (line: string) => {
  const raw = OPTIONS.exec(line)?.[0] ?? '';
  return { color: /color:\s*([#\w]+)/.exec(raw)?.[1], dashed: /\bdashed\b/.test(raw) };
};

/** Подпись, цвет (graph) или форма (diagram) вершины */
export function updateNode(source: string, lang: 'graph' | 'diagram', id: string, change: { label: string; color?: string; shape?: string }): string {
  const lines = source.split('\n');
  const at = nodeLine(lines, lang, id);
  const label = change.label.replace(/"/g, '');
  const position = at === -1 ? '' : (POSITION.exec(lines[at]!)?.[0] ?? '');
  const options = optionsText(change.color);
  const line =
    lang === 'diagram'
      ? `${id}: ${change.shape ?? 'box'} "${label}"${position}${options}`
      : `${id}${label && label !== id ? ` "${label}"` : ''}${position}${options}`;
  if (at === -1) lines.push(line);
  else lines[at] = line;
  return lines.join('\n');
}

export function readEdge(source: string, index: number) {
  const lines = source.split('\n');
  const line = lines[edgeLines(lines)[index] ?? -1];
  const edge = line ? EDGE.exec(line) : null;
  if (!edge) return undefined;
  return { from: edge[1]!, to: edge[3]!, arrow: edge[2]!, label: edge[4]?.trim() ?? '', ...readOptions(line!) };
}

export function readNode(source: string, lang: 'graph' | 'diagram', id: string) {
  const lines = source.split('\n');
  const line = lines[nodeLine(lines, lang, id)] ?? '';
  return {
    label: /"([^"]*)"/.exec(line)?.[1] ?? id,
    shape: lang === 'diagram' ? (/:\s*(box|round|diamond|db|circle)\b/.exec(line)?.[1] ?? 'box') : undefined,
    ...readOptions(line),
  };
}

/** Вес/подпись, цвет, пунктир и направление ребра */
export function updateEdge(source: string, index: number, change: { label: string; color?: string; dashed?: boolean; directed: boolean }): string {
  const lines = source.split('\n');
  const at = edgeLines(lines)[index];
  const edge = at === undefined ? null : EDGE.exec(lines[at]!);
  if (at === undefined || !edge) return source;
  const label = change.label.replace(/[{}]/g, '').trim();
  lines[at] = `${edge[1]} ${change.directed ? '->' : '--'} ${edge[3]}${label ? ` : ${label}` : ''}${optionsText(change.color, change.dashed)}`;
  return lines.join('\n');
}

/** Сдвинуть фигуру холста (index — по порядку фигур) на dx, dy; у линии и стрелки — оба конца */
export function moveCanvasShape(source: string, index: number, dx: number, dy: number): string {
  const lines = source.split('\n');
  const shapes = lines.flatMap((line, at) => (/^\s*(rect|circle|ellipse|line|arrow|text)\s/.test(line) ? [at] : []));
  const at = shapes[index];
  if (at === undefined) return source;
  const shift = (value: string, by: number) => String(Math.round(Number(value) + by));
  lines[at] = lines[at]!.replace(
    /^(\s*(\w+)\s+)(-?[\d.]+)\s+(-?[\d.]+)(\s+(?:->\s+)?)?(-?[\d.]+)?\s*(-?[\d.]+)?/,
    (match, head: string, type: string, x, y, gap, x2, y2) => {
      const start = `${head}${shift(x, dx)} ${shift(y, dy)}`;
      if ((type === 'line' || type === 'arrow') && x2 !== undefined && y2 !== undefined) return `${start}${gap}${shift(x2, dx)} ${shift(y2, dy)}`;
      return `${start}${match.slice(head.length + String(x).length + 1 + String(y).length)}`;
    },
  );
  return lines.join('\n');
}

/** Удалить фигуру холста по номеру */
export function deleteCanvasShape(source: string, index: number): string {
  const lines = source.split('\n');
  const at = lines.flatMap((line, i) => (/^\s*(rect|circle|ellipse|line|arrow|text|path)\s/.test(line) ? [i] : []))[index];
  if (at === undefined) return source;
  lines.splice(at, 1);
  return lines.join('\n');
}

const GRAPH_ID = /^[\p{L}\p{N}_-]+$/u;

/**
 * Импорт графа (как на сайте группы): список рёбер «A B 5» по строке или матрица смежности — первая строка
 * имена вершин, дальше по строке чисел (0 — нет ребра). Возвращает строки рёбер для вставки.
 */
export function importGraph(raw: string, format: 'edges' | 'matrix'): string {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) throw new Error('Введите список рёбер или матрицу.');
  const edges: string[] = [];
  if (format === 'matrix') {
    const names = lines.shift()!.split(/[\s,;]+/);
    if (names.length > 50 || names.some((name) => !GRAPH_ID.test(name)) || new Set(names).size !== names.length || lines.length !== names.length)
      throw new Error('Первая строка — имена вершин, дальше квадратная матрица.');
    lines.forEach((line, i) => {
      const values = line.split(/[\s,;]+/);
      if (values.length === names.length + 1 && values[0] === names[i]) values.shift();
      if (values.length !== names.length || values.some((value) => !Number.isFinite(Number(value))))
        throw new Error(`Строка ${i + 2}: нужно ${names.length} чисел.`);
      values.forEach((value, j) => {
        if (Number(value)) edges.push(`${names[i]} -> ${names[j]} : ${Number(value)}`);
      });
    });
  } else {
    lines.forEach((line, i) => {
      const parts = line.split(/[\s,;]+/);
      if (
        parts.length < 2 ||
        parts.length > 3 ||
        !GRAPH_ID.test(parts[0]!) ||
        !GRAPH_ID.test(parts[1]!) ||
        (parts[2] !== undefined && !Number.isFinite(Number(parts[2])))
      )
        throw new Error(`Строка ${i + 1}: пишите «A B 5» — откуда, куда и вес.`);
      edges.push(`${parts[0]} -> ${parts[1]}${parts[2] === undefined ? '' : ` : ${Number(parts[2])}`}`);
    });
  }
  if (edges.length > 500) throw new Error('Не больше 500 рёбер.');
  return edges.join('\n');
}

/** Ссылка на диаграмму: текст в base64url в адресе (#/diagrams?lang=…&src=…) */
export function encodeShare(source: string): string {
  const bytes = new TextEncoder().encode(source);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(encoded: string): string {
  const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** Авто-раскладка: убрать ручные позиции `@ x, y` — схему снова раскладывает layout */
export function clearPositions(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*[^\s:"]+\s*@\s*-?[\d.]+\s*,\s*-?[\d.]+\s*$/.test(line))
    .map((line) => line.replace(POSITION, ''))
    .join('\n');
}
