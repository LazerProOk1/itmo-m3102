# CLAUDE.md — инструкция для работы с репозиторием

Сайт группы М3102 (ИТМО, 1 курс) на React + TypeScript + Vite. Этот репозиторий — форк
[RedstoneLord/itmo-m3102](https://github.com/RedstoneLord/itmo-m3102). Контент группы (конспекты,
материалы, дедлайны, ДЗ) лежит здесь же в тех же папках и форматах, что у RedstoneLord.

## Правила, которые нельзя нарушать

- **Коммиты — только от имени владельца**: `git -c user.name="LazerProOk1" commit …` (email берётся из
  git-конфига). Никаких строк `Co-Authored-By` и упоминаний ИИ в коммитах, PR и описаниях.
- **Ветки**: работа идёт в `react-app` (ветка по умолчанию) и `react-app-dev`. `legacy` (бывший `master`):
  точная копия RedstoneLord/itmo-m3102 (их старый статический сайт), руками не коммитить — он
  обновляется только синхронизацией (см. ниже). В `RedstoneLord/itmo-m3102` ничего не пушить и PR не
  открывать без прямой просьбы владельца.
- **Секреты**: токены GitHub (PAT) никогда не писать в файлы, коммиты, `.env`, логи и память.
  Пользовательский PAT живёт только в браузере (sessionStorage/localStorage, см. `src/services/github.ts`).
- **Папки контента** (`Конспекты/`, `Материалы/`, `Лабораторные/`, `Записи лекций/`, `Дедлайны/`,
  `data/`, `img/`, `tools/`, `.github/workflows/lectures-index.yml`, `normalize-names.yml`) — это данные
  и автоматизация группы. Их формат не менять: сайт RedstoneLord читает их же.

## Ветки и режимы

| Ветка | `.env` | Что умеет сайт |
|---|---|---|
| `react-app` | `VITE_EDITING=false` | Только просмотр. Деплоится на GitHub Pages. |
| `react-app-dev` | `VITE_EDITING=true` | Кнопка «Редактирование / Просмотр» в шапке: правка расписания, конспектов, ДЗ (с публикацией в GitHub), мемов, ссылок, сроков. |

| `legacy` | — | Копия `master` из RedstoneLord. Синхронизируется кнопкой Actions → «Синхронизировать legacy с RedstoneLord» → Run workflow (и сам раз в сутки), или встроенной «Sync fork», открыв ветку `legacy` на GitHub. |

Встроенную кнопку GitHub «Sync fork» **не нажимать на `react-app` / `react-app-dev`**: она предложит
влить туда старый сайт RedstoneLord или выбросить наши коммиты.

`react-app` и `react-app-dev` отличаются **только** файлом `.env`. Код пишется в `react-app`, затем
переносится в dev: `git checkout react-app-dev && git merge react-app` (в `react-app` `.env` не меняется,
поэтому `VITE_EDITING=true` в dev сохраняется сам). В обратную сторону dev в `react-app` не мержить —
вместе с кодом приедет `.env` с редактированием.

Флаг читается в `src/features/settings/EditModeContext.tsx` (`EDITING_ENABLED`). Всё, что меняет
общие данные, прячется за `const { isEditMode } = useEditMode()`. Личное (учебный план, отметки
«сделано», очередь на сдачу) доступно в обеих ветках.

## Команды

```bash
npm install
npm run dev        # http://localhost:5173 (Vite; .env подхватывается при старте — после смены перезапустить)
npm test           # vitest, юнит-тесты *.test.ts рядом с кодом
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + сборка в dist/
```

Перед каждым коммитом: `npm test` и `npm run build` должны проходить.

## Деплой

`.github/workflows/deploy-pages.yml` — при пуше в `react-app` собирает сайт и публикует на GitHub Pages
(Settings → Pages → Source: GitHub Actions). Адрес: https://lazerprook1.github.io/itmo-m3102/.
`base: './'` + `HashRouter` (`#/schedule`) — сайт работает из подпапки без 404.
Пуш файлов в `.github/workflows/` требует у токена право `workflow`.

## Откуда берутся данные

Бэкенда нет. Всё хранится в `localStorage` браузера (zustand `persist`, ключи `m3102:*`,
см. `src/lib/storage.ts`) и подтягивается синхронизацией:

- `src/services/githubContent.ts` — `syncGithubContent()`:
  - **RedstoneLord/itmo-m3102** (`REPOS.group`): дерево файлов (1 запрос к GitHub API), конспекты
    `Конспекты/{Полное_имя_предмета}/{Лекция_N|Практика_N|Доп_Материалы}/файл`, `Дедлайны/deadlines.json`,
    `data/homework.json`, `data/links.json`; файлы — с raw.githubusercontent.com (без лимита).
  - **Kefirleos/itmo-vault** (`REPOS.stream`): конспекты 1 потока
    `Конспекты/1 семестр/Поток 1/{Предмет}/{NN}. {Тип} - {Название} ({дата}).md` и описания курсов.
  - Записи из GitHub имеют id `gh:{путь}`; пропавшие из репозитория конспекты архивируются.
- `src/services/syncStore.ts` — общий статус синхронизации (кнопка в шапке, «Настройки», «Конспекты»).
  При открытии сайта синхронизация идёт сама, не чаще раза в 10 минут (лимит GitHub API — 60/час без токена).
- `src/data/m3102.ts` — то, чего нет в репозитории: предметы, **расписание** (по скриншотам ИТМО, без
  английского) — только запасное до первой синхронизации; дальше расписание и чётность недель берутся из
  `data/schedule.json` группы (`services/groupSchedule.ts`). Ещё здесь: сопоставление папок с предметами, студенты.
- `src/data/greetings.ts` — приветствия главной (те же, что `js/greetings.js` у RedstoneLord).

Публикация в репозиторий группы (ДЗ, мемы) — `src/services/github.ts` (Contents API + PAT пользователя).

## Структура `src/`

- `app/` — роуты (`App.tsx`) и меню (`navigation.ts`).
- `components/layout` — каркас: боковое меню, шапка (поиск, синхронизация, режим), мобильная навигация.
- `components/ui` — свои компоненты (Button, Modal, List, Tabs, Reveal…), стили — CSS-модули на токенах
  из `src/styles/tokens.css` (цвета, отступы, радиусы; светлая и тёмная темы).
- `components/markdown` — рендер конспектов: GFM, KaTeX, выноски `> [!тип]` и `:::тип … :::` (`lib/remarkCallouts.ts`),
  подсветка кода, mermaid, `[[wiki-ссылки]]`, относительные картинки.
- `components/hedgehog` — ёжик-маскот (SVG + CSS-анимации; по клику сальто).
- `components/diagrams` — SVG-диаграммы из fenced-блоков конспектов; формулы — `expression.ts` (без eval).
- `components/ui/Swap.tsx` — «перелистывание» содержимого; `.stagger` в `styles/global.css` — каскад карточек.
- `features/design` — дизайн-система (`#/design`): бренд, токены, движение, компоненты, элементы сайта
  группы (`SiteDemo.tsx`), контент конспектов. Новый общий элемент — добавить сюда же.
- `lib/download.ts` — `saveBlob` / `downloadUrl` (скачивание чужих файлов через fetch: атрибут `download`
  у ссылок на другой домен браузер игнорирует).
- `features/*` — разделы: `today` (главная), `schedule`, `homework`, `deadlines`, `materials`
  (конспекты, читалка `NoteReader.tsx`), `group` (файлы, ссылки, студенты, мемы, токен), `search`,
  `settings`, `subjects`, `tasks` (учебный план), `notes`, `calendar`.
- `services/` — GitHub и синхронизация. `lib/` — даты, чётность недель (`studyWeek.ts`), утилиты.

## Стиль кода

- Минимализм: без лишних абстракций и зависимостей; сначала смотреть, нет ли уже готового компонента.
- Комментарии по-русски, короткие, только «почему», а не «что».
- Анимации — framer-motion (`lib/motion.ts`: `SPRING_SNAPPY`, `SPRING_SMOOTH`) и CSS; всегда уважать
  `prefers-reduced-motion` (`usePrefersReducedMotion`).
- Тексты интерфейса — по-русски.
- Нетривиальная логика (парсеры, сортировки, слияния) — с маленьким тестом рядом (`*.test.ts`).

## Подводные камни

- На Windows не править TS/регулярки через Python-heredoc — портятся `\n`, `\d` и обратные слеши.
  Использовать обычное редактирование файлов.
- Vite кеширует модули: если после правки странные ошибки — перезапустить dev-сервер.
- id конспектов из GitHub содержат `/`, поэтому маршрут `materials/notes/*`, а не `:noteId`.
- Порядок занятий как у группы: по номеру (Лекция 1, Практика 1, Лекция 2…), см. `compareLessons`.
- PDF (`features/materials/PdfViewer.tsx`) рисуется как на сайте группы: холсты страниц создаются вручную
  в контейнере без React-детей и рисуются один раз. Не переводить обратно на `<Page>` из react-pdf —
  любая перерисовка React очищает холст, и при прокрутке страница «сбрасывается».
- Анимации framer-motion уважают «уменьшить движение» через `<MotionConfig reducedMotion="user">` в `main.tsx`.
- Диаграммы DSL группы (`plot`, `graph`, `diagram`, `tree`, `array`, `chart`) рисует свой рендерер в
  `components/diagrams` (синтаксис — README RedstoneLord). Код пошаговой анимации в `array` (`code:`) не
  выполняется — это чужой JS из репозитория, показывается текстом.
