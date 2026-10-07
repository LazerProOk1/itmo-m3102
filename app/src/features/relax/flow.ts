/**
 * «Релакс»: поле течения из светящихся частиц. Тысячи частиц плывут по плавному полю (сумма синусов, без шума Перлина и
 * без библиотек), оставляя тающие следы; цвета — переливы между двумя акцентами сайта. Курсор или палец закручивает
 * частицы вокруг себя, нажатие — вспышка. Рисует на canvas, всё лишнее (пауза вне экрана, размер под плотность
 * пикселей, «уменьшить движение») — здесь же.
 */

/** Направление течения в точке (x, y) в момент t — угол в радианах. Плавное: соседние точки и моменты дают близкие углы */
export function fieldAngle(x: number, y: number, t: number): number {
  return (
    Math.sin(x * 0.0021 + t * 0.12) * 2.2 +
    Math.cos(y * 0.0027 - t * 0.1) * 2.2 +
    Math.sin((x + y) * 0.0013 + t * 0.07) * 1.5 +
    Math.cos((x - y) * 0.0019 - t * 0.05) * 1.2
  );
}

type Rgb = [number, number, number];

const BUCKETS = 24;
/** Затухание следов за кадр. Слабая заливка в 8 битах «застревает» на сером (разница меньше половины уровня округляется в ноль) —
    поэтому каждый 6-й кадр заливка сильнее и добивает остатки */
const FADE = 0.026;
const FADE_STRONG = 0.13;
const BG: Rgb = [10, 10, 15];

/** Палитра из двух цветов (любая CSS-запись, в том числе oklch): туда и обратно, чтобы цвет не «склеивался» по шву */
export function buildPalette(a: string, b: string): Rgb[] {
  const steps = BUCKETS * 2;
  const probe = document.createElement('canvas');
  probe.width = steps;
  probe.height = 1;
  const context = probe.getContext('2d', { willReadFrequently: true });
  if (!context) return [[91, 108, 249]];
  const gradient = context.createLinearGradient(0, 0, steps, 0);
  // Если браузер не понял цвет, addColorStop бросит ошибку — тогда берём спокойную пару по умолчанию
  try {
    gradient.addColorStop(0, a);
    gradient.addColorStop(1, b);
  } catch {
    gradient.addColorStop(0, '#5b6cf9');
    gradient.addColorStop(1, '#ec4899');
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, steps, 1);
  const data = context.getImageData(0, 0, steps, 1).data;
  const forward: Rgb[] = [];
  for (let index = 0; index < BUCKETS; index++) {
    const at = Math.round((index / (BUCKETS - 1)) * (steps - 1)) * 4;
    forward.push([data[at]!, data[at + 1]!, data[at + 2]!]);
  }
  return [...forward, ...[...forward].reverse()];
}

interface Particle {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  tint: number;
}

export interface Flow {
  /** Новая пара цветов (CSS-записи) — следы плавно перекрасятся */
  setColors: (a: string, b: string) => void;
  setPaused: (paused: boolean) => void;
  /** Остановить и убрать слушатели */
  destroy: () => void;
}

interface FlowOptions {
  colors: [string, string];
  /** «Уменьшить движение»: нарисовать один красивый кадр и не анимировать */
  still: boolean;
}

export function createFlow(canvas: HTMLCanvasElement, { colors, still }: FlowOptions): Flow {
  const context = canvas.getContext('2d');
  if (!context) return { setColors: () => undefined, setPaused: () => undefined, destroy: () => undefined };
  const ctx = context;

  let width = 0;
  let height = 0;
  let ratio = 1;
  let palette = buildPalette(colors[0], colors[1]);
  let particles: Particle[] = [];
  let time = Math.random() * 100;
  let frames = 0;
  let raf = 0;
  let last = 0;
  let paused = false;
  let visible = true;
  let pointer: { x: number; y: number; vx: number; vy: number; active: boolean } = { x: 0, y: 0, vx: 0, vy: 0, active: false };

  const spawn = (particle: Particle, x = Math.random() * width, y = Math.random() * height) => {
    particle.x = particle.px = x;
    particle.y = particle.py = y;
    particle.vx = particle.vy = 0;
    particle.age = 0;
    particle.life = 220 + Math.random() * 380;
    particle.tint = Math.random();
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = `rgb(${BG.join(',')})`;
    ctx.fillRect(0, 0, width, height);
    // Плотность — от площади: на телефоне частиц меньше, чем на широком экране
    const count = Math.round(Math.min(1700, Math.max(280, (width * height) / 600)));
    particles = Array.from({ length: count }, () => {
      const particle = { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, age: 0, life: 1, tint: 0 };
      spawn(particle);
      particle.age = Math.random() * particle.life;
      return particle;
    });
  }

  function step(k: number) {
    time += 0.016 * k;
    // Тающие следы: поверх старого кадра — полупрозрачный фон
    ctx.globalCompositeOperation = 'source-over';
    frames++;
    ctx.fillStyle = `rgba(${BG.join(',')},${frames % 6 === 0 ? FADE_STRONG : FADE})`;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.7;
    ctx.lineCap = 'round';
    const paths: number[][] = Array.from({ length: palette.length }, () => []);
    const shift = time * 0.035;

    for (const p of particles) {
      const angle = fieldAngle(p.x, p.y, time);
      const speed = 0.9 + p.tint * 0.9;
      p.vx += (Math.cos(angle) * speed - p.vx) * 0.08 * k;
      p.vy += (Math.sin(angle) * speed - p.vy) * 0.08 * k;

      if (pointer.active) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        const radius = 130;
        if (distance < radius && distance > 0.5) {
          const force = (1 - distance / radius) ** 2;
          // Закручиваем вокруг курсора и слегка отталкиваем, плюс подхватываем его движение
          p.vx += ((-dy / distance) * 2.4 + (dx / distance) * 0.9 + pointer.vx * 0.05) * force * k;
          p.vy += ((dx / distance) * 2.4 + (dy / distance) * 0.9 + pointer.vy * 0.05) * force * k;
        }
      }

      p.px = p.x;
      p.py = p.y;
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.age += k;

      if (p.age > p.life || p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) {
        spawn(p);
        continue;
      }
      // Цвет — от направления течения и частицы, медленно «переливается» со временем (по кругу туда-обратно)
      const phase = (((angle / (Math.PI * 2) + 0.5 + p.tint * 0.35 + shift) % 1) + 1) % 1;
      paths[Math.floor(phase * palette.length)]!.push(p.px, p.py, p.x, p.y);
    }

    for (let index = 0; index < palette.length; index++) {
      const lines = paths[index]!;
      if (!lines.length) continue;
      const [r, g, b] = palette[index]!;
      ctx.strokeStyle = `rgba(${r},${g},${b},0.55)`;
      ctx.beginPath();
      for (let at = 0; at < lines.length; at += 4) {
        ctx.moveTo(lines[at]!, lines[at + 1]!);
        ctx.lineTo(lines[at + 2]!, lines[at + 3]!);
      }
      ctx.stroke();
    }
    pointer.vx *= 0.8;
    pointer.vy *= 0.8;
  }

  function frame(now: number) {
    raf = 0;
    if (paused || !visible || document.hidden) return;
    const k = last ? Math.min(2.5, (now - last) / 16.7) : 1;
    last = now;
    step(k);
    raf = requestAnimationFrame(frame);
  }

  function run() {
    if (still || raf || paused || !visible || document.hidden) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function halt() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  /** Вспышка: часть частиц собирается в точке нажатия и разлетается кольцом */
  function burst(x: number, y: number) {
    const count = Math.min(70, Math.round(particles.length * 0.08));
    for (let index = 0; index < count; index++) {
      const p = particles[Math.floor(Math.random() * particles.length)]!;
      spawn(p, x, y);
      const angle = (index / count) * Math.PI * 2;
      const power = 3 + Math.random() * 3;
      p.vx = Math.cos(angle) * power;
      p.vy = Math.sin(angle) * power;
    }
  }

  const local = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const onMove = (event: PointerEvent) => {
    const { x, y } = local(event);
    pointer = { x, y, vx: pointer.active ? x - pointer.x : 0, vy: pointer.active ? y - pointer.y : 0, active: true };
  };
  const onLeave = () => {
    pointer.active = false;
  };
  const onDown = (event: PointerEvent) => {
    onMove(event);
    burst(pointer.x, pointer.y);
  };
  const onVisibility = () => (document.hidden ? halt() : run());

  const observer = new ResizeObserver(() => {
    resize();
    // Один кадр сразу — в «неподвижном» режиме это и есть картинка
    if (still) for (let index = 0; index < 260; index++) step(1);
  });
  observer.observe(canvas);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    if (visible) run();
    else halt();
  });
  intersection.observe(canvas);

  if (!still) {
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointercancel', onLeave);
    canvas.addEventListener('pointerdown', onDown);
  }
  document.addEventListener('visibilitychange', onVisibility);
  resize();
  if (still) for (let index = 0; index < 260; index++) step(1);
  run();

  return {
    setColors(a, b) {
      palette = buildPalette(a, b);
      if (still) for (let index = 0; index < 260; index++) step(1);
    },
    setPaused(value) {
      paused = value;
      if (value) halt();
      else run();
    },
    destroy() {
      halt();
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointercancel', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
    },
  };
}
