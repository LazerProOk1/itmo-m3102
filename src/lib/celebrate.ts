import { useEffect, useRef } from 'react';

/**
 * Награда за «сделано». Гайды по микровзаимодействиям сходятся: конфетти — только за веху, не за рутину.
 * Поэтому за каждую отметку — короткая вспышка искр у галочки (~0.5 с), а конфетти — когда закрыто всё.
 * Только transform/opacity через Web Animations API; при «уменьшить движение» ничего не летит.
 */
const COLORS = ['var(--color-accent)', 'var(--color-success)', 'var(--color-warning)', 'var(--glow-b, var(--color-accent))'];

let lastCheck = { at: 0, x: innerWidth / 2, y: innerHeight / 2 };

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function piece(x: number, y: number, width: number, height: number, color: string) {
  const element = document.createElement('i');
  element.className = 'burst-piece';
  element.style.cssText = `left:${x}px;top:${y}px;width:${width}px;height:${height}px;background:${color}`;
  document.body.append(element);
  return element;
}

/** Искры из центра элемента — за одну отметку «сделано» */
export function sparkFrom(element: Element) {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  lastCheck = { at: performance.now(), x, y };
  if (reduced()) return;
  const count = 8;
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2 + Math.random() * 0.5;
    const distance = 18 + Math.random() * 12;
    const spark = piece(x, y, 2, 7, COLORS[index % COLORS.length]!);
    const turn = `${(angle * 180) / Math.PI + 90}deg`;
    spark
      .animate(
        [
          { transform: `translate(-50%, -50%) rotate(${turn}) translateY(-4px) scaleY(1)`, opacity: 1 },
          { transform: `translate(-50%, -50%) rotate(${turn}) translateY(-${distance}px) scaleY(0.2)`, opacity: 0 },
        ],
        { duration: 460, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      )
      .finished.then(
        () => spark.remove(),
        () => spark.remove(),
      );
  }
}

/** Конфетти из точки последней отметки: взлёт, затем падение с вращением */
export function confetti() {
  if (reduced()) return;
  const { x, y } = lastCheck;
  for (let index = 0; index < 44; index++) {
    const dx = (Math.random() - 0.5) * 360;
    const rise = 90 + Math.random() * 120;
    const fall = 160 + Math.random() * 220;
    const spin = (Math.random() - 0.5) * 1080;
    const paper = piece(x, y, 6 + Math.random() * 4, 9 + Math.random() * 5, COLORS[index % COLORS.length]!);
    paper
      .animate(
        [
          { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
          {
            transform: `translate(calc(-50% + ${dx * 0.6}px), calc(-50% - ${rise}px)) rotate(${spin * 0.4}deg)`,
            opacity: 1,
            offset: 0.35,
            easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)',
          },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${fall}px)) rotate(${spin}deg)`, opacity: 0 },
        ],
        { duration: 1300 + Math.random() * 500 },
      )
      .finished.then(
        () => paper.remove(),
        () => paper.remove(),
      );
  }
}

/**
 * Конфетти, когда в списке не осталось открытых пунктов — и только если их только что закрыл человек
 * (а не синхронизация убрала последний дедлайн).
 */
export function useConfettiWhenCleared(open: number) {
  const previous = useRef(open);
  useEffect(() => {
    if (previous.current > 0 && open === 0 && performance.now() - lastCheck.at < 1500) confetti();
    previous.current = open;
  }, [open]);
}
