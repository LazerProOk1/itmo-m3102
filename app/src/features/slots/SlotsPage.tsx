import { useEffect, useRef } from 'react';
import { renderSlotsPage } from './slots.js';
import './slots.css';
import styles from '../game/GamePage.module.css';

/** «Колючий куш» — слоты на ягоды ёжика с сайта группы (автор — RedstoneLord). Страницу рисует сам модуль, он же ведёт сохранение. */
export default function SlotsPage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Свой узел на каждый запуск: в StrictMode эффект идёт дважды, а обработчики модуль вешает на контейнер
    const host = document.createElement('div');
    ref.current.append(host);
    const stop = renderSlotsPage(host);
    return () => {
      stop();
      host.remove();
    };
  }, []);

  return (
    <>
      <div ref={ref} />
      <p className={styles.credit}>
        Игра RedstoneLord с{' '}
        <a href="https://redstonelord.github.io/itmo-m3102/#/slots" target="_blank" rel="noopener noreferrer">
          сайта группы
        </a>
      </p>
    </>
  );
}
