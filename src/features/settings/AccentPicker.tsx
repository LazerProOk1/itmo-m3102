import { AnimatePresence, motion } from 'framer-motion';
import { Check, Pipette } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '../../components/ui/Button';
import { SPRING_SNAPPY } from '../../lib/motion';
import { accentColor, CUSTOM_LIGHTNESS, customAccent, parseCustomAccent } from './appearance';
import styles from './settings.module.css';

const HUE_STOPS = Array.from({ length: 13 }, (_, index) => `oklch(${CUSTOM_LIGHTNESS} 0.2 ${index * 30})`).join(', ');

interface AccentPickerProps {
  accent: string;
  onChange: (accent: string) => void;
}

/**
 * Свой цвет акцента — в стиле сайта, а не системный диалог: оттенок по радуге и насыщенность.
 * Яркость постоянная (OKLCH), поэтому любой выбор одинаково читается в обеих темах. Применяется сразу.
 */
export function AccentPicker({ accent, onChange }: AccentPickerProps) {
  const custom = parseCustomAccent(accent);
  const [open, setOpen] = useState(false);
  const [hue, setHue] = useState(custom?.hue ?? 265);
  const [chroma, setChroma] = useState(custom?.chroma ?? 0.19);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => !rootRef.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    addEventListener('pointerdown', onDown);
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('pointerdown', onDown);
      removeEventListener('keydown', onKey);
    };
  }, [open]);

  function apply(nextHue: number, nextChroma: number) {
    setHue(nextHue);
    setChroma(nextChroma);
    onChange(customAccent(nextHue, nextChroma));
  }

  const color = customAccent(hue, chroma);

  return (
    <div ref={rootRef} className={styles.pickerRoot}>
      <button
        type="button"
        role="radio"
        aria-checked={Boolean(custom)}
        aria-expanded={open}
        aria-label="Свой цвет"
        title="Свой цвет"
        className={styles.swatch}
        style={{ '--swatch': custom ? accentColor(accent) : 'var(--color-bg-hover)' } as CSSProperties}
        onClick={() => {
          if (!custom) apply(hue, chroma);
          setOpen((value) => !value);
        }}
      >
        {custom ? <Check size={14} strokeWidth={3} aria-hidden /> : <Pipette size={14} strokeWidth={2} aria-hidden className={styles.pipette} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.picker}
            role="dialog"
            aria-label="Свой цвет акцента"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={SPRING_SNAPPY}
          >
            <div className={styles.pickerPreview}>
              <span style={{ background: color, boxShadow: `0 6px 20px -6px ${color}` }} />
              <div>
                <strong>Свой цвет</strong>
                <small>Применяется сразу</small>
              </div>
            </div>

            <label className={styles.pickerLabel}>
              Оттенок
              <input
                type="range"
                min={0}
                max={360}
                value={hue}
                onChange={(event) => apply(Number(event.target.value), chroma)}
                className={styles.pickerRange}
                style={{ background: `linear-gradient(to right, ${HUE_STOPS})` }}
              />
            </label>

            <label className={styles.pickerLabel}>
              Насыщенность
              <input
                type="range"
                min={0.04}
                max={0.26}
                step={0.005}
                value={chroma}
                onChange={(event) => apply(hue, Number(event.target.value))}
                className={styles.pickerRange}
                style={{
                  background: `linear-gradient(to right, ${customAccent(hue, 0.04)}, ${customAccent(hue, 0.26)})`,
                }}
              />
            </label>

            <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
              Готово
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
