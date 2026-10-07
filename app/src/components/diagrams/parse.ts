/** Общие строки всех диаграмм DSL группы: title, caption, width, height, layout, комментарии # и // */
export interface DiagramHeader {
  title?: string;
  caption?: string;
  width?: number;
  height?: number;
  layout?: string;
  /** Первая строка-заголовок типа: "graph directed", "chart bar", "array linked" — её слова */
  variant: string[];
}

export interface DiagramLines {
  header: DiagramHeader;
  /** Остальные строки с номерами (1-based) — для сообщений об ошибках */
  body: { text: string; line: number; raw: string }[];
}

const HEADER_KEYS = ['title', 'caption', 'width', 'height', 'layout'] as const;

export function splitLines(source: string, lang: string): DiagramLines {
  const header: DiagramHeader = { variant: [] };
  const body: DiagramLines['body'] = [];
  let first = true;

  source.split(/\r?\n/).forEach((raw, index) => {
    const text = raw
      .replace(/\s+\/\/.*$/, '')
      .replace(/^\s*(#|\/\/).*$/, '')
      .trimEnd();
    if (!text.trim()) return;
    const trimmed = text.trim();

    // Необязательная первая строка с именем типа: "plot", "graph directed", "chart pie"
    if (first) {
      first = false;
      const words = trimmed.split(/\s+/);
      if (words[0] === lang) {
        header.variant = words.slice(1);
        return;
      }
    }

    const match = /^(\w+):\s*(.*)$/.exec(trimmed);
    const key = match?.[1] as (typeof HEADER_KEYS)[number] | undefined;
    if (match && key && HEADER_KEYS.includes(key)) {
      const value = unquote(match[2]!);
      if (key === 'width' || key === 'height') header[key] = Number(value) || undefined;
      else header[key] = value;
      return;
    }
    body.push({ text: trimmed, line: index + 1, raw: text });
  });

  return { header, body };
}

export const unquote = (value: string) => value.trim().replace(/^"(.*)"$/, '$1');

export interface DrawOptions {
  color?: string;
  label?: string;
  dashed?: boolean;
}

/** `{color: red, dashed, label: "T1 (кубическая)"}` в конце строки → опции и строка без них */
export function takeOptions(text: string): { rest: string; options: DrawOptions } {
  const match = /\{([^{}]*)\}\s*$/.exec(text);
  if (!match) return { rest: text.trim(), options: {} };
  const options: DrawOptions = {};
  for (const part of match[1]!.match(/(?:[^,"]+|"[^"]*")+/g) ?? []) {
    const [rawKey, ...rawValue] = part.split(':');
    const key = rawKey!.trim();
    const value = unquote(rawValue.join(':'));
    if (key === 'dashed') options.dashed = true;
    else if (key === 'color') options.color = value;
    else if (key === 'label') options.label = value;
  }
  return { rest: text.slice(0, match.index).trim(), options };
}

/** Палитра DSL: имена цветов → токены темы; #rgb / #rrggbb — как есть */
const COLOR_NAMES: Record<string, string> = {
  red: 'var(--d-red)',
  blue: 'var(--d-blue)',
  green: 'var(--d-green)',
  purple: 'var(--d-purple)',
  orange: 'var(--d-orange)',
  gray: 'var(--d-gray)',
  grey: 'var(--d-gray)',
  black: 'var(--color-text)',
  white: '#ffffff',
};

export const SERIES_COLORS = ['var(--d-blue)', 'var(--d-red)', 'var(--d-green)', 'var(--d-purple)', 'var(--d-orange)', 'var(--d-gray)'];

export function resolveColor(name: string | undefined, fallbackIndex = 0): string {
  if (name && COLOR_NAMES[name]) return COLOR_NAMES[name];
  if (name && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(name)) return name;
  return SERIES_COLORS[fallbackIndex % SERIES_COLORS.length]!;
}

/** Ширина текста примерно (Onest 12px): для размеров узлов без измерения в DOM */
export const textWidth = (text: string, size = 12) => [...text].length * size * 0.56;

/** Перенос текста по словам: не шире maxChars символов в строке */
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (current && [...`${current} ${word}`].length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}
