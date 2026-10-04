import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Kbd } from './Kbd';
import styles from './Tooltip.module.css';

interface TooltipProps {
  /** Текст подсказки — то же, что aria-label у кнопки внутри (скринридеру подсказка не дублируется) */
  text: string;
  /** Сочетание клавиш справа от текста: ['Ctrl', 'B'] */
  keys?: string[];
  /** bottom-start — под кнопкой, от её левого края: для кнопок у левого края экрана */
  side?: 'bottom' | 'bottom-start' | 'right';
  children: ReactNode;
}

/**
 * Подсказка-пилюля под кнопкой-иконкой: появляется при наведении через 0,4 с и сразу при фокусе с клавиатуры.
 * Только CSS — без состояния и порталов; кнопке внутри не нужен title (иначе вылезет ещё и системная подсказка).
 */
export function Tooltip({ text, keys, side = 'bottom', children }: TooltipProps) {
  return (
    <span className={styles.anchor}>
      {children}
      <span className={cn(styles.tip, styles[side === 'bottom-start' ? 'bottomStart' : side])} aria-hidden>
        {text}
        {keys && (
          <span className={styles.keys}>
            {keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </span>
        )}
      </span>
    </span>
  );
}
