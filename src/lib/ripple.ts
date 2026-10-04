/**
 * Волна от точки нажатия — как ripple в Material: круг растёт из-под пальца и гаснет после отпускания.
 * Анимируются только transform и opacity (web.dev: их рисует композитор, без перерисовки страницы).
 * Слой — <i>, а не <span>: не ломает чужие селекторы вида `span:last-of-type`.
 */
const HOSTS = 'button:not(:disabled), a[data-spot], [role="button"], nav a[href]';
/** Material не гасит волну раньше, чем она успела заметно вырасти */
const MIN_VISIBLE_MS = 225;

/** Диаметр круга, который из точки (x, y) накрывает весь прямоугольник — до самого дальнего угла */
export function rippleSize(width: number, height: number, x: number, y: number): number {
  return 2 * Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}

function startRipple(event: PointerEvent) {
  if (event.button !== 0) return;
  const host = (event.target as Element | null)?.closest<HTMLElement>(HOSTS);
  if (!host) return;
  const layer = document.createElement('i');
  layer.className = 'ripple';
  layer.setAttribute('aria-hidden', 'true');
  host.append(layer);
  // Меряем слой, а не хозяина: у растянутой ссылки (кнопка static) слой лежит на всей строке
  const rect = layer.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const size = rippleSize(rect.width, rect.height, x, y);
  const wave = document.createElement('i');
  wave.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px`;
  layer.append(wave);

  const started = performance.now();
  const release = () => {
    host.removeEventListener('pointerup', release);
    host.removeEventListener('pointerleave', release);
    host.removeEventListener('pointercancel', release);
    setTimeout(
      () => {
        layer.classList.add('ripple-out');
        setTimeout(() => layer.remove(), 400);
      },
      Math.max(0, MIN_VISIBLE_MS - (performance.now() - started)),
    );
  };
  host.addEventListener('pointerup', release);
  host.addEventListener('pointerleave', release);
  host.addEventListener('pointercancel', release);
}

/** Один слушатель на всю страницу; возвращает отписку */
export function installRipple(): () => void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  addEventListener('pointerdown', startRipple, { passive: true });
  return () => removeEventListener('pointerdown', startRipple);
}
