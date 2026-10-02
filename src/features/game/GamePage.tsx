import { useEffect, useRef } from 'react';
import { HedgehogGame } from './hedgehogGame.js';
import './hedgehogGame.css';
import styles from './GamePage.module.css';

/** Мини-игра «Ёжик-кувырок» с сайта группы (автор — RedstoneLord). Игра сама рисует меню и сохраняет рекорды. */
export default function GamePage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return HedgehogGame.mount(ref.current);
  }, []);

  return (
    <>
      <div ref={ref} />
      <p className={styles.credit}>
        Игра RedstoneLord с{' '}
        <a href="https://redstonelord.github.io/itmo-m3102/#/hedgehog" target="_blank" rel="noopener noreferrer">
          сайта группы
        </a>
      </p>
    </>
  );
}
