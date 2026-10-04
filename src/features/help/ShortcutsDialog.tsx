import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import { Kbd } from '../../components/ui/Kbd';
import { Modal } from '../../components/ui/Modal';
import styles from './ShortcutsDialog.module.css';

/** Открыто ли окно — открывают и клавиша «?», и пункт в меню пользователя */
export const useShortcutsDialog = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

// Стрелки — иконками: символы ← и → в шрифтах телефонов разного размера и стоят на разной высоте
const KEY_ICONS: Record<string, ReactNode> = {
  '←': <ArrowLeft size={12} strokeWidth={2.25} aria-label="Стрелка влево" />,
  '→': <ArrowRight size={12} strokeWidth={2.25} aria-label="Стрелка вправо" />,
};

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

const GROUPS: { title: string; rows: [keys: string[], what: string][] }[] = [
  {
    title: 'Везде',
    rows: [
      [[MOD, 'K'], 'Поиск по предметам, конспектам, дедлайнам'],
      [[MOD, 'B'], 'Свернуть или открыть боковое меню'],
      [['?'], 'Это окно'],
      [['Esc'], 'Закрыть окно или меню'],
      [['Tab'], 'Первая остановка — «Перейти к содержимому»'],
    ],
  },
  {
    title: 'Вкладки, дни, переключатели',
    rows: [
      [['←', '→'], 'Соседняя вкладка или день'],
      [['Home', 'End'], 'Первая или последняя'],
    ],
  },
  {
    title: 'Тесты',
    rows: [
      [['1', '–', '9'], 'Выбрать вариант ответа'],
      [['Enter'], 'Проверить, затем следующий вопрос'],
    ],
  },
  {
    title: 'Ёжик-кувырок',
    rows: [
      [['Пробел'], 'Свернуться в шар; отпустить — прыжок'],
      [['←', 'A'], 'Бэкфлип в воздухе'],
      [['→', 'D'], 'Фронтфлип в воздухе'],
      [['P'], 'Пауза'],
    ],
  },
];

/** «?» открывает список сочетаний клавиш — кроме полей ввода, где это просто символ */
export function useShortcutsKey() {
  const setOpen = useShortcutsDialog((state) => state.setOpen);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.key !== '?' || (target instanceof Element && target.closest('input, textarea, [contenteditable="true"]'))) return;
      event.preventDefault();
      setOpen(true);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [setOpen]);
}

export function ShortcutsDialog() {
  const { open, setOpen } = useShortcutsDialog();
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Сочетания клавиш">
      <div className={styles.groups}>
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className={styles.title}>{group.title}</h3>
            <dl className={styles.rows}>
              {group.rows.map(([keys, what]) => (
                <div key={what} className={styles.row}>
                  <dt>{keys.map((key, index) => (key === '–' ? <span key={index}>–</span> : <Kbd key={index}>{KEY_ICONS[key] ?? key}</Kbd>))}</dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
