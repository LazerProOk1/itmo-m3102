import { describe, expect, it } from 'vitest';
import type { LectureNote } from '../../types/models';
import { buildSubjectDigest, demoteHeadings, readableUrls } from './aiDigest';

const note = (fields: Partial<LectureNote>) =>
  ({ id: fields.title, subjectId: 'dm', source: 'github', archived: false, contentType: 'markdown', content: '', ...fields }) as LectureNote;

describe('файл предмета для ИИ', () => {
  it('заголовки конспекта — на уровень ниже, код не трогаем', () => {
    expect(demoteHeadings('## Раздел\n```py\n# комментарий\n```\n### Пункт')).toBe('#### Раздел\n```py\n# комментарий\n```\n##### Пункт');
  });

  it('ссылки — с кириллицей, пробел и скобки закодированы', () => {
    expect(readableUrls('[x](https://x/%D0%93%D1%80%D0%B0%D1%84%20%281%29.pdf)')).toBe('[x](https://x/Граф%20%281%29.pdf)');
  });

  it('по порядку занятий, группа отдельно от потока, PDF — текстом, ссылки в конце', () => {
    const text = buildSubjectDigest({
      subjectName: 'Дискретная математика',
      info: [],
      notes: [
        note({ title: 'Графы', lectureNumber: 'Лекция 2', content: '## Определение\nГраф — пара.' }),
        note({ title: 'Множества', lectureNumber: 'Лекция 1', content: 'Множество — набор.' }),
        note({ title: 'Деревья', lectureNumber: 'Лекция 3', contentType: 'pdf', content: 'https://x/d.pdf', sourceRef: 'd.pdf' }),

        // PDF того же занятия, что и .md, — дубль: ссылкой, без текста
        note({ title: 'Графы (PDF)', lectureNumber: 'Лекция 2', contentType: 'pdf', content: 'https://x/g.pdf', sourceRef: 'g.pdf' }),
        note({ title: 'Старое', lectureNumber: 'Лекция 9', archived: true, content: 'не попадает' }),
      ],
      materials: [],
      links: [{ title: 'Задачник', url: 'https://x/book' }],
      personalNotes: [],
      sourceUrl: () => undefined,
      pdfText: (item) => (item.sourceRef === 'd.pdf' ? 'Дерево — связный граф без циклов.' : 'ДУБЛЬ PDF'),
      date: '3 октября',
    });
    const order = ['## Лекция 1. Множества', '## Лекция 2. Графы', '#### Определение', 'связный граф без циклов', '[Задачник](https://x/book)'];
    const positions = order.map((part) => text.indexOf(part));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(text).not.toContain('не попадает');
    expect(text).not.toContain('ДУБЛЬ PDF');
    expect(text).toContain('PDF-версия: https://x/g.pdf');
  });
});
