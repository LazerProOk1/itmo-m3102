import { animate, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { SPRING_SNAPPY, usePrefersReducedMotion } from '../../lib/motion';

interface AnimatedNumberProps {
  value: number;
  /** С какого числа начать при появлении (например, 0 — «набежать» до результата) */
  from?: number;
}

/** Число, которое при смене плавно «доезжает» до нового значения, а не скачет мгновенно. */
export function AnimatedNumber({ value, from }: AnimatedNumberProps) {
  const reduceMotion = usePrefersReducedMotion();
  const motionValue = useMotionValue(from ?? value);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest));
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, SPRING_SNAPPY);
    return controls.stop;
  }, [value, reduceMotion, motionValue]);

  useEffect(
    () =>
      rounded.on('change', (latest) => {
        if (spanRef.current) spanRef.current.textContent = String(latest);
      }),
    [rounded],
  );

  return <span ref={spanRef}>{from ?? value}</span>;
}
