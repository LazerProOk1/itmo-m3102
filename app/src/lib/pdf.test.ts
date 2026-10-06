import { expect, it } from 'vitest';
import { buildPdf } from './pdf';

it('PDF из картинок: таблица xref указывает точно на объекты, название — в UTF-16', async () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const blob = buildPdf(
    [
      { jpeg, width: 2, height: 3 },
      { jpeg, width: 2, height: 3 },
    ],
    'Конспект',
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text = new TextDecoder('latin1').decode(bytes);

  expect(text.startsWith('%PDF-1.4')).toBe(true);
  expect(text).toContain('/Count 2');
  expect(text).toContain('/Title <FEFF041A043E043D0441043F0435043A0442>');
  const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
  expect(text.slice(xref, xref + 4)).toBe('xref');
  const entries = text
    .slice(xref)
    .split('\n')
    .slice(3, 3 + 9);
  entries.forEach((entry, index) => {
    const offset = Number(entry.slice(0, 10));
    expect(text.slice(offset).startsWith(`${index + 1} 0 obj\n`)).toBe(true);
  });
});
