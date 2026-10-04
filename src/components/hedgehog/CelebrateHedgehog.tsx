import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { CLEARED_EVENT } from '../../lib/celebrate';
import { HedgehogSvg } from './Hedgehog';
import styles from './CelebrateHedgehog.module.css';

const PHRASES = ['Всё сделано!', 'Чисто!', 'Фыр, красота.', 'Список пуст — можно чай.'];

/**
 * Ёжик выглядывает из угла, когда человек закрыл последний пункт списка (вместе с конфетти), и через пару секунд
 * прячется. Только за веху — не всплывает по другим поводам и не мешает: без кнопок, мимо него можно кликать.
 */
export function CelebrateHedgehog() {
  const [phrase, setPhrase] = useState('');

  useEffect(() => {
    let timer = 0;
    const show = () => {
      setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]!);
      clearTimeout(timer);
      timer = window.setTimeout(() => setPhrase(''), 2600);
    };
    window.addEventListener(CLEARED_EVENT, show);
    return () => {
      window.removeEventListener(CLEARED_EVENT, show);
      clearTimeout(timer);
    };
  }, []);

  return (
    <AnimatePresence>
      {phrase && (
        <motion.div
          className={styles.peek}
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          role="status"
        >
          <span className={styles.bubble}>{phrase}</span>
          <HedgehogSvg size={72} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
