// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'framer-motion';
import { expect, it } from 'vitest';
import { useQuizStore } from '../../features/quizzes/quizStore';
import { Quiz } from './Quiz';

const SOURCE = `title: Мини
? Сколько будет 2 + 2?
- [ ] 3
- [x] 4
? Столица Франции?
= Париж`;

it('тест: ошибка попадает в повторение, итог прохождения — в результаты', async () => {
  render(
    <MotionConfig reducedMotion="always">
      <Quiz source={SOURCE} quizKey="site:мини" />
    </MotionConfig>,
  );
  const user = userEvent.setup();

  await user.click(screen.getByRole('radio', { name: '3' }));
  await user.click(screen.getByRole('button', { name: 'Проверить' }));
  expect(Object.values(useQuizStore.getState().review)).toMatchObject([{ quiz: 'site:мини', index: 0, step: 0 }]);

  await user.click(await screen.findByRole('button', { name: /Далее/ }));
  await user.type(await screen.findByRole('textbox', { name: 'Ваш ответ' }), 'париж');
  await user.click(screen.getByRole('button', { name: 'Проверить' }));
  await user.click(await screen.findByRole('button', { name: 'Результат' }));

  await waitFor(() => expect(useQuizStore.getState().results['site:мини']).toMatchObject({ best: 0.5, total: 2, attempts: 1 }));
});

it('правильный ответ — только по кнопке; после теста — разбор своих ответов', async () => {
  render(
    <MotionConfig reducedMotion="always">
      <Quiz source={SOURCE} />
    </MotionConfig>,
  );
  const user = userEvent.setup();

  await user.click(screen.getByRole('radio', { name: '3' }));
  await user.click(screen.getByRole('button', { name: 'Проверить' }));
  expect(screen.queryByText(/Правильный ответ:/)).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Показать правильный ответ' }));
  expect(screen.getByText(/Правильный ответ:/)).toBeTruthy();

  await user.click(screen.getByRole('button', { name: /Далее/ }));
  await user.type(await screen.findByRole('textbox', { name: 'Ваш ответ' }), 'Лион');
  await user.click(screen.getByRole('button', { name: 'Проверить' }));
  expect(screen.queryByText('Париж')).toBeNull();
  await user.click(await screen.findByRole('button', { name: 'Результат' }));

  await user.click(await screen.findByRole('button', { name: 'Мои ответы' }));
  const review = screen.getByRole('region', { name: 'Ваши ответы' });
  expect(review.textContent).toContain('Лион');
  expect(review.textContent).not.toContain('Париж');
  await user.click(screen.getByRole('button', { name: 'Показать все правильные' }));
  expect(review.textContent).toContain('Париж');
});

it('Enter на выбранном варианте нажимает «Проверить», а на «Далее» — идёт к следующему вопросу', async () => {
  render(
    <MotionConfig reducedMotion="always">
      <Quiz source={SOURCE} />
    </MotionConfig>,
  );
  const user = userEvent.setup();

  // Без выбранного ответа Enter ничего не проверяет: он лишь выбирает вариант, как обычная кнопка
  const wrong = screen.getByRole('radio', { name: '3' });
  wrong.focus();
  await user.keyboard('{Enter}');
  expect(wrong.getAttribute('aria-checked')).toBe('true');
  expect(screen.queryByText(/Далее/)).toBeNull();

  // Ответ выбран, фокус на варианте — Enter проверяет (вариант не переключается обратно)
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('button', { name: /Далее/ })).toBeTruthy();
  expect(screen.getByRole('radio', { name: '3' }).getAttribute('aria-checked')).toBe('true');

  // После проверки фокус на «Далее»: Enter открывает следующий вопрос
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /Далее/ })));
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('textbox', { name: 'Ваш ответ' })).toBeTruthy();
});
