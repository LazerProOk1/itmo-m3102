// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ArrayPlayer } from './ArrayPlayer';
import { splitLines } from './parse';
import { parseArray } from './TreeArrayChart';

// Пример сайта группы: пузырёк с указателями i, j и done()
const BUBBLE = `array
[5, 2, 9, 1, 7]
pointers: i, j
code:
for (let i = 0; i < a.length - 1; i++) {
  for (let j = 0; j < a.length - 1 - i; j++) {
    if (a[j] > a[j + 1]) {
      let tmp = a[j];
      a[j] = a[j + 1];
      a[j + 1] = tmp;
    }
  }
  done(a.length - 1 - i);
}`;

const parse = (source: string) => parseArray(splitLines(source, 'array'), source);

describe('array с кодом — по шагам', () => {
  it('код выполняется безопасным интерпретатором: в конце массив отсортирован', () => {
    const model = parse(BUBBLE);
    expect(model.steps!.length).toBeGreaterThan(10);
    expect(model.steps!.at(-1)!.vals).toEqual(['1', '2', '5', '7', '9']);
    expect(model.steps!.some((step) => step.kind === 'compare')).toBe(true);
    expect(model.pointerNames).toEqual(['i', 'j']);
  });

  it('опции и ошибки с номером строки', () => {
    expect(parse('array\n[3, 1]\nprint: last\nhidecode\ncode:\nswap(a, 0, 1)').hideCode).toBe(true);
    expect(() => parse('array\n[1]\ncode:\nwindow.alert(1)')).toThrow(/Строка 4/);
    expect(() => parse('array\n[1]\nprint: потом\ncode:\nlet x = 1')).toThrow(/print/);
  });

  it('проигрыватель: кнопка и стрелки двигают шаг, строка кода подсвечена', () => {
    const model = parse(BUBBLE);
    render(<ArrayPlayer model={model} />);
    const last = model.steps!.length - 1;
    expect(screen.getByText(`0 / ${last}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Шаг вперёд' }));
    expect(screen.getByText(`1 / ${last}`)).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('group'), { key: 'End' });
    expect(screen.getByText(`${last} / ${last}`)).toBeTruthy();
    expect(screen.getByText('Готово')).toBeTruthy();
  });
});
