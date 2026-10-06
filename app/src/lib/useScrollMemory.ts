import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router';

const positions = new Map<string, number>();
/** Запись истории, которой принадлежит текущая прокрутка. Меняется до scrollTo, чтобы сброс наверх не затёр прошлую */
let activeKey = '';

/**
 * Прокрутка как в обычном сайте: «Назад»/«Вперёд» возвращают туда, где читал, новый переход — наверх.
 * HashRouter сам этого не умеет. Позиция запоминается по location.key (у каждой записи истории свой).
 */
export function useScrollMemory() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const save = () => positions.set(activeKey, scrollY);
    addEventListener('scroll', save, { passive: true });
    return () => removeEventListener('scroll', save);
  }, []);

  useLayoutEffect(() => {
    activeKey = location.key;
    if (navigationType !== 'POP') {
      scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    const target = positions.get(location.key) ?? 0;
    // instant: в global.css scroll-behavior: smooth, а смена страницы — прыжок, не анимация.
    // Страница дорисовывается не сразу (списки, конспект по разделам) — ждём, пока высоты хватит, но не дольше 3 с
    let frame = 0;
    const started = performance.now();
    const restore = () => {
      const reachable = document.documentElement.scrollHeight - innerHeight >= target;
      scrollTo({ top: target, behavior: 'instant' });
      if (!reachable && performance.now() - started < 3000) frame = requestAnimationFrame(restore);
    };
    restore();
    return () => cancelAnimationFrame(frame);
  }, [location.key, navigationType]);
}
