/**
 * Склеивает CSS-классы и пропускает пустые значения.
 * cn('a', isActive && 'b') → "a b" (если isActive) или "a"
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
