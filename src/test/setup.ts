/**
 * Чего нет в jsdom, но ждут компоненты: matchMedia (тема, «уменьшить движение»), ResizeObserver,
 * IntersectionObserver, scrollTo. В Node-тестах (без window) ничего не делаем.
 */
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

if (typeof window !== 'undefined') {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;

  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  window.ResizeObserver ??= Observer as unknown as typeof ResizeObserver;
  window.IntersectionObserver ??= Observer as unknown as typeof IntersectionObserver;
  window.scrollTo = () => {};
  // Докачка страниц в простое (App.tsx) в тестах не нужна: импорты переживали тест и падали после teardown
  window.requestIdleCallback = () => 0;
  // Тесты не ходят в сеть: синхронизация видит «нет интернета» и остаётся на сохранённых данных
  window.fetch = () => Promise.reject(new TypeError('Сеть в тестах отключена'));
  // <dialog> в jsdom без showModal/close
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  Element.prototype.scrollIntoView ??= () => {};
}
