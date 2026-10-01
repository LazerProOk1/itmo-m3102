import type { Blockquote, Paragraph, Root, RootContent } from 'mdast';

/**
 * Выноски Obsidian `> [!тип] Заголовок` — типы и цвета как на сайте группы M3102
 * (remember/note/meaning/warning/example/formula и русские синонимы) плюс стандартные типы Obsidian.
 */
export const CALLOUT_LABELS = {
  remember: 'Запомнить',
  note: 'Заметка',
  meaning: 'Определение',
  warning: 'Важно',
  example: 'Пример',
  formula: 'Формула',
  info: 'Информация',
  tip: 'Совет',
  question: 'Вопрос',
  quote: 'Цитата',
} as const;

export type CalloutType = keyof typeof CALLOUT_LABELS;

const ALIASES: Record<string, CalloutType> = {
  запомнить: 'remember',
  danger: 'remember',
  error: 'remember',
  failure: 'remember',
  fail: 'remember',
  bug: 'remember',
  заметка: 'note',
  todo: 'note',
  определение: 'meaning',
  definition: 'meaning',
  abstract: 'meaning',
  summary: 'meaning',
  tldr: 'meaning',
  важно: 'warning',
  внимание: 'warning',
  caution: 'warning',
  attention: 'warning',
  important: 'warning',
  пример: 'example',
  формула: 'formula',
  hint: 'tip',
  success: 'tip',
  check: 'tip',
  done: 'tip',
  help: 'question',
  faq: 'question',
  cite: 'quote',
};

export function resolveCalloutType(raw: string): CalloutType {
  const key = raw.toLowerCase();
  return key in CALLOUT_LABELS ? (key as CalloutType) : (ALIASES[key] ?? 'note');
}

const MARKER = /^\[!([\p{L}\w-]+)\][+-]?[ \t]*([^\n]*)\n?/u;

function transformCallout(node: Blockquote): void {
  const first = node.children[0];
  if (first?.type !== 'paragraph') return;
  const text = first.children[0];
  if (text?.type !== 'text') return;
  const match = MARKER.exec(text.value);
  if (!match) return;

  const type = resolveCalloutType(match[1]!);
  text.value = text.value.slice(match[0].length);
  if (!text.value) first.children.shift();
  if (first.children.length === 0) node.children.shift();

  const title: Paragraph = {
    type: 'paragraph',
    data: { hProperties: { className: ['callout-title'] } },
    children: [{ type: 'text', value: match[2]!.trim() || CALLOUT_LABELS[type] }],
  };
  node.children.unshift(title);
  node.data = { ...node.data, hName: 'div', hProperties: { className: ['callout'], dataCallout: type } };
}

function walk(node: Root | RootContent): void {
  if (node.type === 'blockquote') transformCallout(node);
  if ('children' in node) node.children.forEach(walk);
}

export function remarkCallouts() {
  return (tree: Root) => walk(tree);
}
