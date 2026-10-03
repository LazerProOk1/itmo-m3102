/**
 * Делит markdown на разделы по заголовкам `## ` — чтобы большой конспект рисовать по частям: первый экран сразу,
 * остальное следом. Не режет внутри блоков кода (``` и ~~~), формул `$$ … $$` и выносок `::: … :::`.
 */
export function splitSections(markdown: string): string[] {
  const lines = markdown.split('\n');
  const sections: string[][] = [[]];
  let fence = '';
  let math = false;
  let container = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = /^(```|~~~)/.exec(trimmed);
    if (fenceMatch && !math) fence = fence ? (trimmed.startsWith(fence) ? '' : fence) : fenceMatch[1]!;
    else if (!fence && trimmed === '$$') math = !math;
    else if (!fence && !math && /^:::/.test(trimmed)) container = trimmed !== ':::';
    const free = !fence && !math && !container;
    if (free && line.startsWith('## ') && sections[sections.length - 1]!.some((item) => item.trim())) sections.push([]);
    sections[sections.length - 1]!.push(line);
  }
  return sections.map((section) => section.join('\n'));
}
