// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expect, it } from 'vitest';
import { useLectureNotesStore } from '../materials/lectureNotesStore';
import { SearchDialog } from './SearchDialog';

function Where() {
  return <p data-testid="where">{decodeURIComponent(useLocation().pathname)}</p>;
}

it('поиск: находит конспект по тексту внутри, Enter открывает его', async () => {
  const now = new Date().toISOString();
  useLectureNotesStore.setState({
    lectureNotes: [
      {
        id: 'gh:Конспекты/АиСД/master.md',
        subjectId: 'aisd',
        lectureNumber: 'Практика 3',
        title: 'Мастер-теорема',
        contentType: 'markdown',
        content: '# Мастер-теорема\n\nРекуррента T(n) = aT(n/b) + f(n) решается сравнением f(n) с n^log_b(a).',
        source: 'github',
        archived: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
  });

  render(
    <MemoryRouter>
      <SearchDialog open onClose={() => {}} />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

  await userEvent.type(screen.getByRole('textbox', { name: 'Поиск' }), 'рекуррента');
  expect(await screen.findByText('Практика 3. Мастер-теорема')).toBeTruthy();
  await userEvent.keyboard('{Enter}');
  expect(screen.getByTestId('where').textContent).toBe('/materials/notes/gh:Конспекты/АиСД/master.md');
});
