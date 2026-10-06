/** На Mac сочетания клавиш пишутся через ⌘, на Windows и Linux — через Ctrl */
export const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

export const MOD_KEY = isMac ? '⌘' : 'Ctrl';
