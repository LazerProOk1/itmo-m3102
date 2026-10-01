import { describe, expect, it } from 'vitest';
import { normalizeMath } from './mathCompat';

describe('normalizeMath', () => {
  it('$$x$$ одной строкой — формула по центру, в том числе в выноске', () => {
    expect(normalizeMath('текст\n$$a + b$$\n> $$z = a$$')).toBe('текст\n$$\na + b\n$$\n> $$\n> z = a\n> $$');
  });

  it('| в формуле внутри таблицы — \\vert, \\| — \\Vert; вне таблиц и в коде не трогаем', () => {
    expect(normalizeMath('| $|A| = 3$ | $\\|x\\|$ |')).toBe('| $\\vert A\\vert  = 3$ | $\\Vert x\\Vert $ |');
    expect(normalizeMath('$|A|$ в тексте')).toBe('$|A|$ в тексте');
    expect(normalizeMath('```\n$$x$$\n| $|a|$ |\n```')).toBe('```\n$$x$$\n| $|a|$ |\n```');
  });
});
