import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Курсор-aware свечение внутри карточки: пишет позицию курсора в CSS-переменные
 * прямо на элементе (без ре-рендера), а сам градиент рисует CSS (см. .glow в модуле стилей карточки).
 */
export function useCursorGlow() {
  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--glow-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
    event.currentTarget.style.setProperty('--glow-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
  }

  function onPointerLeave(event: ReactPointerEvent<HTMLElement>) {
    event.currentTarget.style.removeProperty('--glow-x');
    event.currentTarget.style.removeProperty('--glow-y');
  }

  return { onPointerMove, onPointerLeave };
}
