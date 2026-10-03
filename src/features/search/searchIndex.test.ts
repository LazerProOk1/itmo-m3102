import { describe, expect, it } from 'vitest';
import { normalize, plainText, snippet } from './searchIndex';

describe('поиск по тексту', () => {
  it('markdown → простой текст', () => {
    expect(plainText('## Предикат $P(x)$\n> [!info] Важно\n**жирный** [[Дискретная математика|ДМ]] [ссылка](https://x.y)')).toBe(
      'Предикат P(x) Важно жирный ДМ ссылка',
    );
  });

  it('код ищется, схемы — нет', () => {
    expect(plainText('```cpp\nstd::vector v;\n```\n```mermaid\ngraph TD\n```')).toBe('std::vector v;');
  });

  it('формулы читаемые', () => {
    expect(plainText('Рефлексивность: $\\forall a: a \\le a$ на $\\mathbb{R}$')).toBe('Рефлексивность: ∀ a: a ≤ a на R');
  });

  it('сниппет вокруг совпадения, ё = е', () => {
    const text = 'Начало. '.repeat(10) + 'Тут ёжик делает сальто. ' + 'Конец. '.repeat(10);
    const found = snippet(text, normalize('ежик'));
    expect(found).toContain('ёжик делает сальто');
    expect(found?.startsWith('…')).toBe(true);
    expect(snippet(text, 'нет такого')).toBeUndefined();
  });
});
