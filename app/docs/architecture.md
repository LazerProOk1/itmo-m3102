# Архитектура приложения

Правила разработки и принятые решения — в [`AGENTS.md`](../../AGENTS.md). Здесь — как устроено: папки, адреса, состояние, загрузка данных, сборка.

## Стек
React 19, TypeScript (строгий режим), Vite, `react-router` (`HashRouter`), `zustand` (+`persist`), `framer-motion`, `lucide-react`. Конспекты — `react-markdown`
с GFM, KaTeX, подсветкой кода, mermaid и своими рендерерами схем; PDF — `react-pdf`. Тесты — Vitest (+ Testing Library, jsdom) и Playwright. Версии — `package.json`.

## Структура папок (`app/`)

| Путь | Что |
|---|---|
| `src/main.tsx` | вход: шрифты, стили, `MotionConfig`, `ErrorBoundary`, регистрация сервис-воркера (только в сборке) |
| `src/app/` | `App.tsx` (маршруты, `page()` — ленивые страницы и докачка в простое), `navigation.ts` (единый список разделов для обоих меню) |
| `src/components/` | `layout/` (каркас), `ui/` (базовые элементы), `markdown/`, `diagrams/`, `quiz/`, `hedgehog/`, `radio/` |
| `src/features/` | разделы: `today`, `schedule`, `calendar`, `materials`, `subjects`, `tasks`, `deadlines`, `homework`, `quizzes`, `notes`, `search`, `settings`, `group`, `diagrams`, `game`, `slots`, `design`, `help`, `more` |
| `src/services/` | `github.ts` (REST, токен), `githubContent.ts` (синхронизация), `syncStore.ts` (статус), `groupSchedule.ts`, `offline.ts`, `googleDrive.ts` |
| `src/lib/` | утилиты и хуки (даты, хранилище, движение, ics, pdf…) |
| `src/styles/` | `tokens.css` (токены, темы), `global.css` (база, печать), `aurora.css` (сияние и свечение) |
| `src/data/` | то, чего нет в репозитории группы: предметы, студенты, запасное расписание (`m3102.ts`), приветствия, описания курсов, тесты |
| `public/` | `sw.js`, манифест, иконки, `switch/site-switch.js` |
| `scripts/` | сборка готового сайта (`assemble-classic.ts`), `build-ics.ts`, `check-size.mjs` |
| `e2e/` | сценарии Playwright и заглушки GitHub |

## Адреса и base path
- `vite.config.ts`: `base: './'` — пути к файлам сборки относительные, приложение работает из любой подпапки (на Pages — `/itmo-m3102/app/`).
- `HashRouter`: адрес страницы после `#` (`#/schedule?view=month`). У GitHub Pages нет серверной маршрутизации, поэтому прямые ссылки и обновление страницы
  работают только так; адрес без `#` на Pages даёт 404.
- Состояние страницы — в адресе, чтобы «Назад» шёл на шаг: `?tab=` (Материалы, Дедлайны, Настройки, Предмет), `?view=day|week|month` (Расписание), `?date=`.
- Старые адреса перенаправляются: `#/calendar` → `#/schedule?view=month`, `#/homework` → `#/deadlines?tab=homework`; неизвестный адрес → `#/today`.
- Страницы грузятся кусками (`page()`): при открытии качается главная, остальные докачиваются в простое или при первом движении мыши/касании.

## Состояние
- Бэкенда нет. Каждое хранилище — zustand `persist` в `localStorage`, ключи `m3102:*` (`src/lib/storage.ts`): `settings`, `tasks`, `notes`, `homework`, `group`, `lecture-notes`,
  `subject-info`, `materials`, `subjects`, `schedule`, `semester`, `events`, `quizzes`, `marks`, `offline`, `queue`, `contributors`, `radio`, `pdf-pages`, `diagram-draft`,
  `last-sync`, `dynamic-accent`. Токен GitHub — `m3102-github-token-v1` (sessionStorage, при «Запомнить» — localStorage).
- Формат хранилища меняется только с миграцией (`version` + `migrate` у `persist`): у `settings` версия 5 (стартовые страницы `/calendar` и `/homework` переводятся на новые адреса).
- `localStore` при нехватке места (квота ~5 МБ) сначала выбрасывает кеш конспектов и описаний курсов и пишет ещё раз; `idleStorage` откладывает запись больших хранилищ.
  Если браузер запретил данные сайта, приложение работает без запоминания.
- Личные отметки (сделано, задачи, заметки) не покидают устройство.

## Загрузка данных из GitHub (`services/githubContent.ts`)
1. **Дерево файлов репозитория группы.** Сначала читается готовый `data/tree.json` с `raw.githubusercontent.com` (без лимита API); нет файла, он не читается или формат не тот —
   один запрос `GET /repos/RedstoneLord/itmo-m3102/git/trees/master?recursive=1` (лимит API без токена — 60 в час на IP).
2. **Файлы** — с `raw.githubusercontent.com`: `Дедлайны/deadlines.json`, `data/homework.json`, `data/links.json`, `data/schedule.json` (необязателен), конспекты
   `Конспекты/{Предмет}/{Папка}/{файл}.md`. PDF и картинки читаются прямо по `raw`-адресу при открытии.
3. **Кеш по sha:** конспект не качается заново, если `sourceVersion` = `{PARSER_VERSION}:{sha}`; версия ставится, только если git blob sha скачанных байтов совпал с деревом.
4. **Адреса:** каждый сегмент пути кодируется `encodeURIComponent` (кириллица и пробелы в именах покрыты юнит-тестом).
5. **Когда:** при открытии сайта и по кнопке; автосинхронизация — не чаще раза в 10 минут и только после успешной (метка `m3102:last-sync`); запросы с тайм-аутом 20 с;
   без сети — сообщение и повтор по событию `online`.
6. **Сбои:** ошибка дерева, дедлайнов, ДЗ или ссылок — синхронизация неудачна, данные остаются прошлые. Недоступный конспект пропускается (остаётся прошлая копия).
7. **Очередь на сдачу** — открытые issues с меткой `queue-signup` (`features/deadlines/queueStore.ts`), кеш `m3102:queue`, не чаще раза в 2 минуты.
8. **Запись** в репозиторий (ДЗ, мемы) — `services/github.ts` (Contents API + токен пользователя); в боевой сборке выключена (`VITE_EDITING=false`).

### Формат `data/tree.json`
Тот же JSON, что отдаёт API дерева: `gh api repos/RedstoneLord/itmo-m3102/git/trees/master?recursive=1 > data/tree.json`.

```json
{
  "truncated": false,
  "tree": [
    { "path": "Конспекты/Дискретная_математика/Лекция_1/Графы.md", "type": "blob", "sha": "<git blob sha>", "size": 1234 },
    { "path": "Конспекты", "type": "tree", "sha": "<tree sha>" }
  ]
}
```

Файл принимается (`parseTree`), если: это объект с массивом `tree`; `truncated` не `true`; у каждого элемента строки `path`, `type`, `sha`; в дереве есть `data/homework.json` и
`Дедлайны/deadlines.json` (признак того, что это дерево всего репозитория, а не его части). Берутся только `blob`. Иначе файл игнорируется и дерево запрашивается у API.
Файл должен пересоздаваться при каждом изменении содержимого: пока он старее репозитория, новые файлы в приложении не видны (и raw держит ответ в кеше до ~5 минут).
Папка `data/` скрыта в файловом браузере приложения (`isHiddenPath`), поэтому `tree.json` там не показывается.

## Стили
CSS Modules на токенах `styles/tokens.css`. Тема и оформление — атрибуты на `<html>` (`data-theme`, `data-sidebar`, `data-aurora`, `data-radius`…), читаются через
`:global(:root[...])`. Акценты — зарегистрированные `@property`-цвета; шрифты — Onest (текст) и Unbounded (заголовки) с подогнанными запасными. Печать и «Скачать PDF» всегда светлые.

## Сервис-воркер и офлайн
`public/sw.js` (регистрируется только в сборке): навигация — сначала сеть, при сбое кеш; при установке в кеш `m3102-vN` кладётся оболочка и все страницы по `asset-manifest.json`
(без `PdfViewer` и mermaid); PDF и картинки с `raw.githubusercontent.com` — из кеша с обновлением в фоне. «Работа без интернета» (`services/offline.ts`) складывает файлы и код читалки PDF в
кеш `m3102-offline`. Если у части приложения нет кода на устройстве (читалка PDF до первого открытия), без сети показывается «Нет интернета». Сменил файлы с постоянными
именами (иконки, водяной знак) — поднимай `CACHE` в `sw.js`.

## Сборка и деплой
`npm run build` (`tsc --noEmit && vite build`) → `app/dist`; `npm run ics` → `dist/m3102.ics`; `npm run site` → `app/site`: сайт из корня репозитория — в корне адреса, приложение — в `/app/`.
CI — `.github/workflows/deploy-pages.yml`: на каждый пуш в `master` и раз в сутки; Pages настроены на источник «GitHub Actions». Шаги и бюджеты — в [`README.md`](../README.md) и `AGENTS.md`.
