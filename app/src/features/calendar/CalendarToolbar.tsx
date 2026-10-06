import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '../../components/ui/IconButton';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/SegmentedControl';
import styles from './CalendarToolbar.module.css';

export type CalendarMode = 'month' | 'week' | 'day';

const MODE_OPTIONS: SegmentedOption<CalendarMode>[] = [
  { value: 'month', label: 'Месяц' },
  { value: 'week', label: 'Неделя' },
  { value: 'day', label: 'День' },
];

interface CalendarToolbarProps {
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

/** Панель над календарём: переход по месяцу/неделе/дню, «Сегодня», Месяц/Неделя/День. */
export function CalendarToolbar({ mode, onModeChange, onPrevious, onNext, onToday }: CalendarToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.nav}>
        <IconButton icon={ChevronLeft} label="Назад" size="sm" onClick={onPrevious} />
        <button type="button" className={styles.today} onClick={onToday}>
          Сегодня
        </button>
        <IconButton icon={ChevronRight} label="Вперёд" size="sm" onClick={onNext} />
      </div>

      <SegmentedControl label="Вид календаря" options={MODE_OPTIONS} value={mode} onChange={onModeChange} />
    </div>
  );
}
