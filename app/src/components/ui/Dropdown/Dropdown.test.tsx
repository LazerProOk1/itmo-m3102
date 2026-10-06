// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dropdown } from './Dropdown';

const OPTIONS = Array.from({ length: 30 }, (_, index) => ({ value: `v${index}`, label: `Вариант ${index}` }));

describe('Dropdown', () => {
  it('прокрутка самого списка не закрывает меню, прокрутка страницы — закрывает', async () => {
    render(<Dropdown options={OPTIONS} value="" onChange={() => {}} placeholder="Выбрать" />);
    fireEvent.click(screen.getByRole('button', { name: /Выбрать/ }));
    const option = screen.getByRole('option', { name: 'Вариант 0' });
    fireEvent.scroll(option.parentElement!);
    await new Promise((resolve) => setTimeout(resolve, 500)); // дать закрытию (анимации) отработать, если оно случилось
    expect(screen.queryByRole('option', { name: 'Вариант 0' })).not.toBeNull();
    fireEvent.scroll(document);
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Вариант 0' })).toBeNull());
  });
});
