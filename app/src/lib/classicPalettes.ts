/** Палитра классической версии: пара цветов (акцент и второй акцент) */
export interface ClassicPalette {
  id: string;
  name: string;
  a: string;
  b: string;
  /** Доступна сразу; остальные открываются капсулами «Колючего куша» (в альбоме — pal:<id>) */
  base: boolean;
}

/**
 * Палитры из файлов группы: цвета — css/settings.css (`--pal-<id>-a` / `-b`), список, названия, «базовые» и палитра по умолчанию —
 * js/settings.js. Читается при сборке (vite.config.ts), сами файлы не меняем. Палитра без обоих цветов в список не попадает.
 */
export function parseClassicPalettes(css: string, js: string): { palettes: ClassicPalette[]; defaultId: string } {
  const colors = new Map<string, { a?: string; b?: string }>();
  for (const match of css.matchAll(/--pal-([a-z0-9]+)-([ab])\s*:\s*(#[0-9a-f]{6})/gi)) {
    const entry = colors.get(match[1]!) ?? {};
    entry[match[2]!.toLowerCase() as 'a' | 'b'] = match[3]!;
    colors.set(match[1]!, entry);
  }
  const list = /const PALETTES\s*=\s*\[([\s\S]*?)\];/.exec(js)?.[1] ?? '';
  const baseBody = /const BASE_PALETTES\s*=\s*\[([^\]]*)\]/.exec(js)?.[1] ?? '';
  const base = new Set([...baseBody.matchAll(/'([a-z0-9]+)'/g)].map((match) => match[1]!));
  const palettes: ClassicPalette[] = [];
  for (const match of list.matchAll(/\{\s*id:\s*'([a-z0-9]+)'\s*,\s*name:\s*'([^']+)'\s*\}/g)) {
    const pair = colors.get(match[1]!);
    if (pair?.a && pair.b) palettes.push({ id: match[1]!, name: match[2]!, a: pair.a, b: pair.b, base: base.has(match[1]!) });
  }
  const defaultId = /const DEFAULT_PALETTE\s*=\s*'([a-z0-9]+)'/.exec(js)?.[1] ?? '';
  return { palettes, defaultId: palettes.some((item) => item.id === defaultId) ? defaultId : (palettes[0]?.id ?? '') };
}
