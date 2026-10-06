const FENCE = /^[ \t>]*(```|~~~)/;
/** Строка — только формула `$$…$$` (может быть внутри выноски `> `) */
const ONE_LINE_DISPLAY = /^([ \t>]*)\$\$([^$\n]+)\$\$[ \t]*\r?$/;
const TABLE_ROW = /^[ \t>]*\|/;
const MATH_SPAN = /\$\$?[^$\n]+?\$\$?/g;

/**
 * Формулы так, как их понимают Obsidian и сайт группы, а remark-math — нет:
 * - `$$x$$` одной строкой — формула по центру, а не мелкая строчная;
 * - `|` внутри формулы в таблице (`$|A|$`) GFM считает границей ячейки — меняем на `\vert`
 *   (`\|` — на `\Vert`), выглядит так же.
 */
export function normalizeMath(text: string): string {
  if (!text.includes('$')) return text;
  let fence = '';
  return text
    .split('\n')
    .map((line) => {
      const fenceMatch = FENCE.exec(line);
      if (fenceMatch) fence = fence ? (fence === fenceMatch[1] ? '' : fence) : fenceMatch[1]!;
      if (fence || fenceMatch) return line;
      const display = ONE_LINE_DISPLAY.exec(line);
      if (display) {
        const [, prefix] = display;
        return `${prefix}$$\n${prefix}${display[2]!.trim()}\n${prefix}$$`;
      }
      if (TABLE_ROW.test(line)) {
        return line.replace(MATH_SPAN, (span) => span.replace(/\\\|/g, '\\Vert ').replace(/\|/g, '\\vert '));
      }
      return line;
    })
    .join('\n');
}
