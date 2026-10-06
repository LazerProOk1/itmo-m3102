import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { cn } from '../../lib/cn';
import { useSettingsStore, type Density } from '../settings/settingsStore';
import { arrangeBlocks, HOME_BLOCKS, moveBlock, START_PAGES, type HomeBlockId } from './homeLayout';
import styles from './HomeCustomizeDialog.module.css';

/**
 * «Настроить главную»: какие блоки видно и в каком порядке, плотность интерфейса и что открывается при запуске.
 * Одному нужно расписание сверху, другому — дедлайны и подготовка к экзаменам. Хранится в этом браузере.
 */
export function HomeCustomizeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { homeOrder, homeHidden, startPage, density, setAppearance } = useSettingsStore();
  const order = arrangeBlocks(homeOrder);
  const hidden = new Set(homeHidden);
  const label = (id: HomeBlockId) => HOME_BLOCKS.find((block) => block.id === id)!.label;

  const toggle = (id: HomeBlockId) => setAppearance({ homeHidden: hidden.has(id) ? homeHidden.filter((item) => item !== id) : [...homeHidden, id] });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Настроить главную"
      description="Порядок и видимость блоков, плотность интерфейса и стартовая страница — только в этом браузере."
      footer={
        <>
          <Button
            variant="ghost"
            icon={RotateCcw}
            onClick={() => setAppearance({ homeOrder: [], homeHidden: [], startPage: '/today', density: 'comfortable' })}
          >
            Как было
          </Button>
          <Button variant="primary" onClick={onClose}>
            Готово
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <ol className={styles.blocks} aria-label="Блоки главной">
          {order.map((id, index) => (
            <li key={id} className={cn(styles.block, hidden.has(id) && styles.off)}>
              <label className={styles.check}>
                <input type="checkbox" checked={!hidden.has(id)} onChange={() => toggle(id)} />
                {label(id)}
              </label>
              <button
                type="button"
                className={styles.move}
                aria-label={`${label(id)} — выше`}
                disabled={index === 0}
                onClick={() => setAppearance({ homeOrder: moveBlock(order, id, -1) })}
              >
                <ArrowUp size={15} aria-hidden />
              </button>
              <button
                type="button"
                className={styles.move}
                aria-label={`${label(id)} — ниже`}
                disabled={index === order.length - 1}
                onClick={() => setAppearance({ homeOrder: moveBlock(order, id, 1) })}
              >
                <ArrowDown size={15} aria-hidden />
              </button>
            </li>
          ))}
        </ol>

        <Field label="Плотность">
          <SegmentedControl<Density>
            label="Плотность интерфейса"
            options={[
              { value: 'comfortable', label: 'Просторно' },
              { value: 'compact', label: 'Компактно' },
            ]}
            value={density}
            onChange={(value) => setAppearance({ density: value })}
          />
        </Field>

        <Field label="Открывать при запуске" htmlFor="start-page">
          <select id="start-page" className={styles.select} value={startPage} onChange={(event) => setAppearance({ startPage: event.target.value })}>
            {START_PAGES.map((page) => (
              <option key={page.value} value={page.value}>
                {page.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
