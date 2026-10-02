/**
 * Станции капсулы-радио — открытые потоки laut.fm: играют на сторонних сайтах без ограничений.
 * (SomaFM не подходит: из браузера на чужом сайте отдаёт ошибку, проверено.)
 */
export interface Station {
  id: string;
  name: string;
  description: string;
  url: string;
  source: { name: string; href: string };
}

const laut = (id: string, name: string, description: string): Station => ({
  id,
  name,
  description,
  url: `https://stream.laut.fm/${id}`,
  source: { name: 'laut.fm', href: `https://laut.fm/${id}` },
});

export const STATIONS: Station[] = [
  laut('lofi', 'Lo-fi', 'Лоу-фай хип-хоп для учёбы'),
  laut('chillout', 'Chillout', 'Спокойная электроника'),
  laut('lounge', 'Lounge', 'Лаунж и даунтемпо'),
  laut('jazz', 'Jazz', 'Джаз для фона'),
  laut('synthwave', 'Synthwave', 'Ретро-синтвейв для дедлайнов'),
  laut('ambient', 'Ambient', 'Эмбиент — почти тишина'),
];
