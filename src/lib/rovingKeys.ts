import type { KeyboardEvent } from 'react';

const KEYS: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowDown: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  ArrowUp: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_, count) => count - 1,
};

/**
 * Стрелки/Home/End в группе (вкладки, переключатель) — как велит ARIA: Tab заходит только на выбранный
 * вариант, дальше ходят стрелками, выбор сразу применяется. Кнопки ищутся по роли внутри группы.
 */
export function onRovingKeyDown<T>(event: KeyboardEvent<HTMLElement>, values: T[], current: T, onChange: (value: T) => void) {
  const move = KEYS[event.key];
  if (!move || values.length === 0) return;
  event.preventDefault();
  const next = move(Math.max(0, values.indexOf(current)), values.length);
  onChange(values[next]!);
  const buttons = event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"], [role="tab"]');
  const target = buttons[next];
  target?.focus();
  // В прокручиваемом переключателе (телефон) выбранный вариант должен быть виден
  target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
