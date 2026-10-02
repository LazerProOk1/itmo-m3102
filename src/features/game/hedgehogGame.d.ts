/** Типы для перенесённой игры (сам код — обычный JS, см. hedgehogGame.js) */
export const HedgehogGame: {
  /** Рисует игру в container; возвращает функцию остановки (снимает обработчики, сохраняет прогресс) */
  mount(container: HTMLElement, opts?: { onBack?: () => void }): () => void;
};
