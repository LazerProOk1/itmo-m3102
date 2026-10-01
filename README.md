# М3102 — учебное пространство группы

Сайт группы на React + TypeScript + Vite. Расписание, общие домашние задания, дедлайны, материалы и конспекты.
Личные отметки выполнения, учебный план и черновики хранятся в браузере.

Контент лежит в этом же репозитории, в тех же папках и форматах, что и раньше:

- `Конспекты/`, `Материалы/`, `Лабораторные/`, `Записи лекций/` — файлы по предметам;
- `Дедлайны/deadlines.json` — сроки сдачи;
- `data/homework.json` — общее ДЗ, `data/links.json` — полезные ссылки, `data/memes.json` + `img/memes/` — мемы;
- `tools/` и `.github/workflows/` — индексы лекций и нормализация имён файлов (без изменений).

Кнопка «Синхронизировать» (раздел «Конспекты» и «Настройки») подтягивает всё это из
[RedstoneLord/itmo-m3102](https://github.com/RedstoneLord/itmo-m3102), а конспекты 1 потока — из
[Kefirleos/itmo-vault](https://github.com/Kefirleos/itmo-vault). При открытии сайта синхронизация идёт сама,
не чаще раза в 10 минут.

## Запуск

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # юнит-тесты
npm run build      # сборка в dist/
```

## Публикация ДЗ и мемов для всей группы

Нужен fine-grained PAT с доступом только к `RedstoneLord/itmo-m3102` и правом **Contents: Read and write**
([создать](https://github.com/settings/personal-access-tokens/new)). Токен вводится в окне публикации или в «Настройках».
Без «Запомнить» он живёт только во вкладке (`sessionStorage`). Токен не попадает в адрес страницы и в JSON.
ДЗ при публикации сливается с версией на GitHub по `id`, поэтому чужие задания не затираются.

## Деплой на GitHub Pages

`.github/workflows/deploy-pages.yml` собирает сайт и публикует его при пуше в `master`.
В настройках репозитория: Settings → Pages → Source: **GitHub Actions**.
`base: './'` и hash-роутинг (`#/schedule`) работают из любой подпапки без 404.
