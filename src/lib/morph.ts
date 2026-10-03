import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';

/** Ждём, пока ленивая страница отрисует заголовок, — иначе браузер снимет «новое» состояние пустым */
async function waitFor(found: () => unknown, timeout: number) {
  const start = performance.now();
  while (!found() && performance.now() - start < timeout) await new Promise(requestAnimationFrame);
}

/**
 * Переход «карточка → страница»: заголовок карточки перетекает в заголовок новой страницы (View Transitions,
 * общий view-transition-name у старого и нового элемента). Встроенный viewTransition у <Link> работает только
 * с data-роутером, у нас HashRouter — поэтому свой перехват клика по `a[data-morph]`.
 * Источник — `[data-morph-title]` внутри ссылки (или сама ссылка), цель — `[data-morph-target]` (h1 страницы).
 */
export function useMorphLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!('startViewTransition' in document)) return undefined;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[data-morph]');
      const href = link?.getAttribute('href');
      if (!link || !href?.startsWith('#/') || href === location.hash) return;
      // Раньше обработчика <Link> (слушаем на погружении): он видит defaultPrevented и сам не переходит
      event.preventDefault();

      const source = link.querySelector<HTMLElement>('[data-morph-title]') ?? link;
      const root = document.documentElement;
      source.style.viewTransitionName = 'morph-title';
      // Пока снимается старое состояние, у заголовка текущей страницы имени нет — иначе два одинаковых имени
      root.classList.add('morph-from');
      root.classList.add('morphing');
      const transition = document.startViewTransition(async () => {
        source.style.viewTransitionName = '';
        root.classList.remove('morph-from');
        flushSync(() => navigate(href.slice(1)));
        await waitFor(() => document.querySelector('main [data-morph-target]'), 200);
      });
      void transition.finished.finally(() => root.classList.remove('morphing'));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [navigate]);
}
