/** Станции капсулы-радио: открытые потоки, которые разрешают слушать на сторонних сайтах */
export interface Station {
  id: string;
  name: string;
  description: string;
  url: string;
  source: { name: string; href: string };
}

const SOMA = { name: 'SomaFM', href: 'https://somafm.com' };

export const STATIONS: Station[] = [
  {
    id: 'lofi',
    name: 'Lo-fi',
    description: 'Лоу-фай хип-хоп для учёбы',
    url: 'https://stream.laut.fm/lofi',
    source: { name: 'laut.fm', href: 'https://laut.fm/lofi' },
  },
  { id: 'fluid', name: 'Fluid', description: 'Инструментальный хип-хоп и соул', url: 'https://ice2.somafm.com/fluid-128-mp3', source: SOMA },
  { id: 'groove', name: 'Groove Salad', description: 'Чилаут и даунтемпо', url: 'https://ice4.somafm.com/groovesalad-128-mp3', source: SOMA },
  { id: 'lush', name: 'Lush', description: 'Спокойный вокал и электроника', url: 'https://ice2.somafm.com/lush-128-mp3', source: SOMA },
  { id: 'space', name: 'Deep Space', description: 'Эмбиент — когда нужна тишина, но не совсем', url: 'https://ice2.somafm.com/deepspaceone-128-mp3', source: SOMA },
];
