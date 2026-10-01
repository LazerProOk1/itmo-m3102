import { motion } from 'framer-motion';
import { Check, RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSyncStore } from '../../services/syncStore';
import { HedgehogSvg } from '../hedgehog/Hedgehog';
import styles from './SyncButton.module.css';

/** Синхронизация с репозиториями группы и 1 потока — из любой страницы. Пока идёт, катится ёжик. */
export function SyncButton() {
  const status = useSyncStore((state) => state.status);
  const error = useSyncStore((state) => state.error);
  const run = useSyncStore((state) => state.run);
  const [flash, setFlash] = useState(false);

  // «Готово» показываем пару секунд и возвращаем обычную иконку
  useEffect(() => {
    if (status !== 'done') return;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 2200);
    return () => clearTimeout(timer);
  }, [status]);

  const label =
    status === 'syncing'
      ? 'Синхронизация с GitHub…'
      : status === 'error'
        ? `Ошибка синхронизации: ${error}`
        : 'Синхронизировать: конспекты, дедлайны, ДЗ, ссылки и файлы группы';

  return (
    <button type="button" className={styles.button} onClick={run} disabled={status === 'syncing'} aria-label={label} title={label}>
      {status === 'syncing' ? (
        <motion.span className={styles.rolling} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
          <HedgehogSvg size={22} />
        </motion.span>
      ) : status === 'error' ? (
        <TriangleAlert size={16} strokeWidth={1.75} className={styles.error} aria-hidden />
      ) : flash ? (
        <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={styles.ok}>
          <Check size={16} strokeWidth={2} aria-hidden />
        </motion.span>
      ) : (
        <RefreshCw size={15} strokeWidth={1.75} aria-hidden />
      )}
      <span className={styles.text}>{status === 'syncing' ? 'Синхронизация…' : 'Синхронизировать'}</span>
    </button>
  );
}
