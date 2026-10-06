/** Конфетти на canvas поверх страницы — за верные ответы и хороший результат теста, как на сайте группы */

const COLORS = ['#5b5fef', '#7c7ffb', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  rotation: number;
  spin: number;
  w: number;
  h: number;
  color: string;
  round: boolean;
  life: number;
}

let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let frame = 0;

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function stage() {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1000';
    document.body.appendChild(canvas);
    context = canvas.getContext('2d');
  }
  if (canvas.width !== innerWidth || canvas.height !== innerHeight) {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }
}

function tick() {
  if (!canvas || !context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter((p) => p.life > 0 && p.y < canvas!.height + 30);
  for (const p of particles) {
    p.vy += p.gravity;
    p.vx *= 0.992;
    p.vy *= 0.992;
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.spin;
    p.life--;
    context.save();
    context.globalAlpha = Math.min(1, p.life / 25);
    context.translate(p.x, p.y);
    context.rotate(p.rotation);
    context.fillStyle = p.color;
    if (p.round) {
      context.beginPath();
      context.arc(0, 0, p.w / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    context.restore();
  }
  if (particles.length) {
    frame = requestAnimationFrame(tick);
  } else {
    frame = 0;
    canvas.remove();
    canvas = context = null;
  }
}

function particle(x: number, y: number, angle: number, speed: number, index: number, gravity: number, life: number): Particle {
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    gravity,
    rotation: Math.random() * 6,
    spin: (Math.random() - 0.5) * 0.4,
    w: 6 + Math.random() * 6,
    h: 4 + Math.random() * 5,
    color: COLORS[index % COLORS.length]!,
    round: Math.random() < 0.25,
    life,
  };
}

function start() {
  if (!frame) frame = requestAnimationFrame(tick);
}

/** Хлопушка из точки: вверх веером или во все стороны */
export function burst(x: number, y: number, count: number, radial = false) {
  if (calm()) return;
  stage();
  for (let i = 0; i < count; i++) {
    const angle = radial ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
    const speed = (radial ? 3 : 4) + Math.random() * (radial ? 7 : 9);
    particles.push(particle(x, y, angle, speed, i, 0.28, 70 + Math.random() * 50));
  }
  start();
}

/** Дождь конфетти сверху — за отличный результат */
export function rain(count: number) {
  if (calm()) return;
  stage();
  for (let i = 0; i < count; i++) {
    const p = particle(Math.random() * innerWidth, -Math.random() * 500, Math.PI / 2, 2 + Math.random() * 3, i, 0.04, 420);
    p.vx = (Math.random() - 0.5) * 2;
    particles.push(p);
  }
  start();
}
