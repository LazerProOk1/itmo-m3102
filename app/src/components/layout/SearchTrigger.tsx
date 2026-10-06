import { Search } from 'lucide-react';
import { MOD_KEY } from '../../lib/platform';
import { IconButton } from '../ui/IconButton';
import { Kbd } from '../ui/Kbd';
import styles from './SearchTrigger.module.css';

interface SearchTriggerProps {
  onClick: () => void;
}

/** Кнопка поиска: на компьютере похожа на поле ввода, на телефоне — просто иконка. */
export function SearchTrigger({ onClick }: SearchTriggerProps) {
  return (
    <>
      <button type="button" className={styles.field} onClick={onClick}>
        <Search size={14} strokeWidth={1.75} aria-hidden />
        <span className={styles.placeholder}>Поиск…</span>
        <Kbd>{MOD_KEY} K</Kbd>
      </button>

      <span className={styles.mobile}>
        <IconButton icon={Search} label="Поиск" onClick={onClick} />
      </span>
    </>
  );
}
