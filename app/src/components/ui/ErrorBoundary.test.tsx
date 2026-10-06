// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Broken(): never {
  throw new Error('сломалось');
}

it('ошибка внутри — сообщение вместо белого экрана, соседи живы', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  render(
    <>
      <nav>меню</nav>
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>
    </>,
  );
  expect(screen.getByRole('alert').textContent).toContain('Эта страница сломалась');
  expect(screen.getByText('сломалось')).toBeTruthy();
  expect(screen.getByText('меню')).toBeTruthy();
});
