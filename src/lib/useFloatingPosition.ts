import { useLayoutEffect, useState, type RefObject } from 'react';

export interface FloatingCoords {
  left: number;
  top?: number;
  bottom?: number;
}

const GAP = 6;

/**
 * Позиция плавающего слоя (popover/меню), заякоренного за DOM-узел, но отрисованного
 * через портал в document.body — с базовым collision detection: открывается вниз,
 * но переворачивается вверх, если снизу не хватает места, а сверху больше; по горизонтали
 * якорится по левому краю, но переезжает к правому краю якоря, если иначе вылезет за экран.
 *
 * position: fixed (не absolute) — координаты уже в системе viewport, поэтому портал
 * в document.body не обязателен для позиционирования, но обязателен, чтобы контент не был
 * заперт в stacking context ближайшего трансформированного предка (см. историю бага
 * с popover-деталями занятия в расписании — карточка с hover-lift ловила popover внутри себя).
 */
export function useFloatingPosition(
  anchorRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  open: boolean,
  align: 'start' | 'end' = 'start',
): FloatingCoords | null {
  const [coords, setCoords] = useState<FloatingCoords | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    function measure() {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const anchorRect = anchor.getBoundingClientRect();
      const contentWidth = contentRef.current?.offsetWidth ?? 240;
      const contentHeight = contentRef.current?.offsetHeight ?? 200;

      const spaceBelow = window.innerHeight - anchorRect.bottom;
      const spaceAbove = anchorRect.top;
      const openUp = spaceBelow < contentHeight + GAP && spaceAbove > spaceBelow;

      const preferredLeft = align === 'end' ? anchorRect.right - contentWidth : anchorRect.left;
      const overflowsRight = preferredLeft + contentWidth > window.innerWidth - GAP;
      const overflowsLeft = preferredLeft < GAP;
      const left = overflowsRight
        ? Math.max(GAP, anchorRect.right - contentWidth)
        : overflowsLeft
          ? GAP
          : preferredLeft;

      setCoords(
        openUp
          ? { left, bottom: window.innerHeight - anchorRect.top + GAP }
          : { left, top: anchorRect.bottom + GAP },
      );
    }

    measure();
    // Первый замер содержимого может ещё не иметь реальной высоты — перемеряем на следующий кадр
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [open, align, anchorRef, contentRef]);

  return coords;
}
