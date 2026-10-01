const URL_PATTERN = /^https?:\/\/\S+$/;

function isValidUrl(value: string): boolean {
  return URL_PATTERN.test(value.trim());
}

/** Текст ошибки, если ссылка указана и не начинается с http(s)://. Пустая ссылка допустима. */
export function checkUrl(value: string): string | undefined {
  if (value.trim() && !isValidUrl(value)) return 'Укажите полную ссылку, начинающуюся с https://';
  return undefined;
}
