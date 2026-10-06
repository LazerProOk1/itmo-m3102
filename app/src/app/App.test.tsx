// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { App } from './App';

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name }, { timeout: 10_000 });

it('навигация: меню → предметы → предмет, «Назад» возвращает по шагам', async () => {
  window.location.hash = '#/today';
  render(<App />);
  // Сеть в тестах отключена — главная всё равно открывается на сохранённых данных
  expect(await screen.findByText(/Всё важное для группы/, {}, { timeout: 10_000 })).toBeTruthy();

  const menu = screen.getAllByRole('navigation')[0]!;
  await userEvent.click(within(menu).getByRole('link', { name: /Предметы/ }));
  expect(await heading('Предметы')).toBeTruthy();

  await userEvent.click(await screen.findByRole('link', { name: 'Алгоритмы и структуры данных' }));
  expect(await heading('Алгоритмы и структуры данных')).toBeTruthy();
  expect(window.location.hash).toBe('#/subjects/aisd');

  window.history.back();
  expect(await heading('Предметы')).toBeTruthy();
  window.history.back();
  expect(await screen.findByText(/Всё важное для группы/, {}, { timeout: 10_000 })).toBeTruthy();
  // Ленивые страницы в первый раз компилируются — под нагрузкой всего набора это дольше 5 с
}, 45_000);
