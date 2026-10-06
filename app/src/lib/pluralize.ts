/**
 * Русское склонение числительных (3 формы): 1 задача, 2 задачи, 5 задач.
 * pluralize(1, ['задача', 'задачи', 'задач']) → "1 задача"
 * pluralize(3, ['задача', 'задачи', 'задач']) → "3 задачи"
 * pluralize(5, ['задача', 'задачи', 'задач']) → "5 задач"
 */
export function pluralize(count: number, forms: [one: string, few: string, many: string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} ${forms[0]}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${forms[1]}`;
  return `${count} ${forms[2]}`;
}
