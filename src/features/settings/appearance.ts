import { useEffect } from 'react';
import { useSettingsStore } from './settingsStore';

/** Готовые акценты: насыщенные, но не «кислотные» — читаются и на светлом, и на тёмном фоне */
export const ACCENTS = [
  { id: 'indigo', name: 'Индиго', color: '#5b6cf9' },
  { id: 'violet', name: 'Фиалка', color: '#8b5cf6' },
  { id: 'sky', name: 'Небо', color: '#0ea5e9' },
  { id: 'teal', name: 'Бирюза', color: '#14b8a6' },
  { id: 'emerald', name: 'Изумруд', color: '#22c55e' },
  { id: 'amber', name: 'Янтарь', color: '#f59e0b' },
  { id: 'coral', name: 'Коралл', color: '#f43f5e' },
  { id: 'rose', name: 'Роза', color: '#ec4899' },
] as const;

export const accentColor = (accent: string) =>
  ACCENTS.find((item) => item.id === accent)?.color ?? (/^#[0-9a-f]{6}$/i.test(accent) ? accent : ACCENTS[0].color);

/**
 * Оформление на <html>: --accent-base (из него в tokens.css считаются все оттенки акцента),
 * data-aurora / data-glow / data-radius — по ним включаются слои из styles/aurora.css.
 */
export function useApplyAppearance() {
  const { accent, aurora, glow, radius } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent-base', accentColor(accent));
    root.dataset.aurora = aurora ? 'on' : 'off';
    root.dataset.glow = glow ? 'on' : 'off';
    root.dataset.radius = radius;
  }, [accent, aurora, glow, radius]);

  // Подсветка под курсором: один обработчик на всю страницу пишет координаты в ту карточку
  // [data-spot], над которой курсор, — никаких слушателей на каждой карточке
  useEffect(() => {
    if (!glow) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const update = () => {
      frame = 0;
      const card = (last?.target as Element | null)?.closest<HTMLElement>('[data-spot]');
      if (!card || !last) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${last.clientX - rect.left}px`);
      card.style.setProperty('--my', `${last.clientY - rect.top}px`);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      last = event;
      if (!frame) frame = requestAnimationFrame(update);
    };
    addEventListener('pointermove', onMove, { passive: true });
    return () => {
      removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [glow]);
}
