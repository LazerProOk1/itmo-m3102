# AGENTS.md — как устроен и как разрабатывается репозиторий

Это общая инструкция и для людей, и для ИИ-агентов (Claude Code, Codex, Cursor и др.): правила веток
и коммитов, устройство кода, договорённости по дизайну и решения, которые уже приняты, с причинами.
Перед тем как менять код, прочитай раздел про ту часть, которую трогаешь; поменял устройство — допиши сюда.
`CLAUDE.md` — только ссылка на этот файл для Claude Code.

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

Ветка `design-aurora` (от `react-app`) — эксперимент с ярким дизайном для первого впечатления: слой
`src/styles/aurora.css` (сияние за страницей, сетка, зерно, градиентный заголовок, подсветка карточек
`[data-spot]` под курсором, светящиеся кнопки) и настройки «Оформление»: акцент (готовые цвета или свой —
из него в tokens.css через `color-mix` считаются все оттенки), фон-сияние, свечение, скругления
(`features/settings/appearance.ts`). Не деплоится; в `react-app` вливать только по решению владельца.

Встроенную кнопку GitHub «Sync fork» **не нажимать на `react-app` / `react-app-dev`**: она предложит
влить туда старый сайт RedstoneLord или выбросить наши коммиты.

Если RedstoneLord меняет файлы в `.github/workflows/`, workflow синхронизации падает с
`refusing to allow a GitHub App to create or update workflow` (у токена Actions нет права `workflows`).
Тогда синхронизировать `legacy` вручную: «Sync fork» на ветке `legacy` или
`gh api -X POST repos/LazerProOk1/itmo-m3102/merge-upstream -f branch=legacy` (токен со scope `workflow`).

Изменения в репозитории группы проверять так: `gh api "repos/RedstoneLord/itmo-m3102/commits?per_page=10"`.
Контент (конспекты, `data/*.json`) сайт подтягивает сам; в код переносить только изменения форматов и
поведения (например, очередь: метку `queue-signup` теперь ставит их workflow, а не `?labels=` в ссылке).

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
npm run test:e2e   # Playwright: собирает сайт и гоняет сценарии в браузере (e2e/)
npm run size       # бюджет размера сборки (после build): scripts/check-size.mjs
npm run lighthouse # Lighthouse по dist/ (lighthouserc.json); на Windows: CHROME_PATH=путь к msedge.exe
```

**Бюджеты в CI.** `npm run size` падает, если JS первой загрузки (сейчас ~194 КБ gzip), CSS или одна страница
(конспект ~198 КБ) тяжелее порога в `scripts/check-size.mjs` — так тяжёлая библиотека не попадёт в общий код
незаметно. Lighthouse (3 прогона, медиана): доступность и практики ≥ 0,9, сдвиг вёрстки CLS ≤ 0,1 — ошибка;
производительность ≥ 0,5 — предупреждение (эмуляция слабого телефона с 4× замедлением шумит; сейчас ~0,55).
Отчёты — артефакт `lighthouse` у запуска Actions.

Перед каждым коммитом: `npm test` и `npm run build` должны проходить.

**Автотесты в браузере** (`e2e/`, `playwright.config.ts`) — по собранному сайту через `vite preview`, как на
GitHub Pages (сервис-воркер, чанки, View Transitions). GitHub подменён заглушками `e2e/github.ts`: два конспекта
(md и PDF, PDF генерируется в коде), остальной интернет обрывается — тесты не зависят от сети. Часы зафиксированы
на 1 октября 2026, 12:00 МСК. Сценарии: переход с главной на предмет (замер внутри страницы, < 1 с), поиск по
тексту конспекта, неделя расписания, PDF (тёмные страницы, «Продолжить»), офлайн, телефон (свайп дней и нет
горизонтальной прокрутки; проект `phone`, тег `@phone`). Локально — установленный Edge (`channel: 'msedge'`),
в CI — Chromium (`npx playwright install chromium`). Тест упал — `npx playwright show-trace test-results/…/trace.zip`.
Ждать синхронизацию — `openSynced()`, иначе тест начнёт раньше, чем появятся конспекты.
Форматирование — `npm run format` (Prettier, `.prettierrc.json`: одинарные кавычки, строка до 150);
`npm run format:check` — проверка. Код игры (`features/game/hedgehogGame.*`) Prettier не трогает (`.prettierignore`).
ESLint пока не подключён: `typescript-eslint` поддерживает TypeScript только до 6.0, а у нас 7 — добавить,
когда выйдет поддержка. TypeScript строгий: `strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`.

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
  - Кеш по sha: у конспекта `sourceVersion` = `{PARSER_VERSION}:{sha из дерева}`, неизменённый файл не качается.
    Версия ставится, только если git blob sha скачанного совпал (raw кеширует ~5 мин). **Поменял разбор файлов
    (stripFrontMatter, splitTitle, quizPageToMarkdown, папки предметов) — увеличь `PARSER_VERSION`**, иначе
    старые конспекты останутся разобранными по-старому. Обрезанное дерево (`truncated`) — ошибка, не архивация.
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
- Совместимость конспектов с сайтом группы (`components/markdown/Markdown.tsx` перед разбором):
  `:::тип … :::` → выноски, `$$x$$` одной строкой → формула по центру, `|` в формулах внутри таблиц →
  `\vert` (`lib/mathCompat.ts`). `\[ … \]` в формулы НЕ превращать: в конспектах это `\\[4pt]` внутри LaTeX.
- Тесты: блок ```quiz в конспекте или файл-тест (`mode: quiz` первой строкой) — формат сайта группы,
  разбор в `components/quiz/parseQuiz.ts` (с тестами), интерфейс — `Quiz.tsx`. Файл-тест при синхронизации
  превращается в один блок ```quiz (`quizPageToMarkdown`).
- Игра «Ёжик-кувырок» (`features/game/hedgehogGame.js`) — код RedstoneLord из его index.html, перенесён как
  есть; наши правки помечены «Правка поверх оригинала» (стиль сайта: иконки вместо эмодзи, шрифт Inter,
  векторные значки на canvas). При обновлении его игры — перенести заново и повторить правки.
- Навигация: состояние разделов — в адресе (`/materials?tab=…&c=group&s=aisd`, `/subjects/:id?tab=…`),
  чтобы «Назад» шёл на шаг назад. Прокрутку при «Назад» восстанавливает `lib/useScrollMemory.ts`
  (в AppShell); на страницах не вызывать `scrollTo(0)` самим.
- `Markdown` обёрнут в `memo`: без него каждая перерисовка читалки (оглавление при прокрутке)
  переразбирала конспект с KaTeX — прокрутка зависала на сотни мс. В PDF страницы рисуются по одной
  очередью; без `backdrop-filter` на прилипающих панелях.
- Синхронизация: защита от двойного запуска — в `services/syncStore.ts` (статус ставится до первого await),
  без флагов уровня модуля. Нет сети → понятный текст и досинхронизация по событию `online` (App.tsx);
  лимит GitHub → `githubError(status, write, response)` пишет время сброса из `X-RateLimit-Reset`.
- Клавиатура: группы (SegmentedControl, Tabs, дни в расписании) — стрелки/Home/End через `lib/rovingKeys.ts`,
  Tab заходит только на выбранный вариант; первая остановка Tab — «Перейти к содержимому» (AppShell).
- Ошибки: `components/ui/ErrorBoundary.tsx` — вокруг каждой страницы (AppShell, сбрасывается сменой пути) и всего
  приложения (main.tsx). Падение страницы — сообщение с «Обновить» и «Скопировать ошибку», меню работает.
  Устаревший чанк после деплоя («Failed to fetch dynamically imported module») — сама перезагрузка, не чаще раза в 30 с.
- Движение: `.stagger` — тихий каскад (4px, шаг 30 мс, не дольше 6 карточек); смена страницы и `Swap` — tween
  ~250 мс с expo-out, без blur и пружин на больших областях (давали рывки).
- Клик-эффекты (`lib/ripple.ts`, включаются «Свечением»): волна — `<i class="ripple">`, временно добавляемый в
  конец кнопки/ссылки/карточки. Внутри кнопок не опираться на `:last-child` (брать `span:last-of-type`).
  Рамка за курсором — `::after` у `[data-spot]`; карточке со своим `::after` ставить `data-spot="own"`.
- Награда за «сделано» (`lib/celebrate.ts`): `<Checkbox celebrate>` — искры у галочки; `useConfettiWhenCleared(open)` —
  конфетти, когда человек закрыл последний пункт списка. Конфетти только за вехи, не за каждую отметку.
- Скорость: конспект рисуется по разделам `## ` (`lib/splitSections.ts`, `ProgressiveMarkdown`), сначала шапка и скелет;
  хранилище конспектов (~1 МБ) пишется в localStorage в простое (`idleStorage` в `lib/storage.ts`); тесты в
  конспектах ищутся с кешем по версии конспекта. Поле даты — `components/ui/DateInput.tsx`, не `<input type="date">`.
- Переход «карточка → страница» (`lib/morph.ts`, только мышь — на телефоне переход мгновенный): ссылка `data-morph`, внутри `[data-morph-title]`; цель — h1 с
  `data-morph-target` (уже в PageHeader и читалке). `viewTransition` у `<Link>` с HashRouter не работает.
- Загрузка: страницы — отдельные куски (`page()` в App.tsx) с докачкой в простое. На главной Markdown только
  через `LazyMarkdown`; не импортировать из страниц в главную (так `filePath` тянул за собой весь Markdown).
- Шрифт заголовков — `--font-display` (Unbounded), текст — Inter. Серые подкрашены акцентом, свечение — оттенки
  одного акцента: радужные градиенты и градиентный текст выглядят «сгенерированно».
- За каждым шрифтом в стеке — `Inter Fallback` / `Unbounded Fallback` (`tokens.css`): Arial с подогнанными
  `size-adjust` и `ascent/descent-override`, чтобы подмена шрифта при загрузке не сдвигала вёрстку. Меняешь шрифт —
  перемерь метрики (ширина текста и `fontBoundingBoxAscent/Descent` против Arial в canvas).
- Логотип в шапке — `src/assets/logo-mask.webp` (600px, 6 КБ), уменьшенная копия `img/logo-t.png` (папка группы).
- Тесты «Проверь себя» к конспектам M3102 — наши, не из репозитория группы: `src/data/siteQuizzes/<путь как в
  Конспекты/>.md` (формат parseQuiz), подключение — `features/materials/siteQuizzes.ts`. Показываются, только если в
  конспекте нет своего ```quiz. Вопросы только по предмету — без организационных (баллы, экзамены, правила). Новый конспект у группы — добавить тест сюда же; `siteQuizzes.test.ts` проверяет разбор.
- Тесты интерфейса — `*.test.tsx` с `// @vitest-environment jsdom` (Testing Library); заглушки jsdom и отключённая
  сеть — в `src/test/setup.ts`.
- Результаты тестов и повторение ошибок — `features/quizzes/quizStore.ts` (ключ `site:<путь>` или `note:<путь>#<название>`,
  ошибка возвращается через 1–3–7–14 дней). Набор тестов предмета — `quizSources.ts`; смешанный тест (повторение,
  «Перед контрольной») — `CombinedQuiz.tsx`. Прогресс предмета — `QuizProgress.tsx` (засчитан от 80%).
- Закладки и пометки — `features/materials/marksStore.ts`; подсветка — CSS Custom Highlight API (`NoteMarks.tsx`,
  поиск места — `lib/textRange.ts`), DOM конспекта не трогаем.
- Офлайн и установка: `public/sw.js` + `public/manifest.webmanifest`, иконки — из `public/icon.svg` (ёжик).
  SW регистрируется только в сборке; при установке кладёт в кеш оболочку и все страницы по `asset-manifest.json`
  (vite.config.ts), без pdf.js и mermaid. Проверять — конфигурацией `m3102-preview` (vite preview), не dev-сервером.
- Живой фон (`liveBg` в настройках): appearance.ts пишет `--bg-x/--bg-y/--bg-s` на `.aurora`, пятна сдвигаются `translate`.
- Неделя расписания — сетка по часам (`WeekView`, раскладка в `weekGrid.ts` с тестом): высота карточки = длительность
  (`--ppm` пикселей на минуту), пары в одно время делят колонку (дорожки), линия «сейчас», прошедшие пары бледнее,
  воскресенье — только если есть пары. На телефоне дни листаются вбок со snap, колонка часов sticky. «День» — свайп
  влево/вправо меняет день (за край — соседняя неделя). Длинные названия переносятся (`hyphens`), «Лабораторная» → «Лаба».
  Месяц календаря на телефоне — цветные полоски вместо строк, нажатие на клетку открывает день.
- API ИТМО (my.itmo, БАРС, ITMO.ID) закрыты входом через ITMO ID и CORS — со статического сайта без своего сервера
  недоступны; пароли студентов на сайт не принимать. План сервера (Go, вход через ITMO ID, роли, мемы, очереди) — `docs/BACKEND_PLAN.md`.
- Диаграммы DSL группы (`plot`, `graph`, `diagram`, `tree`, `array`, `chart`) рисует свой рендерер в
  `components/diagrams` (синтаксис — README RedstoneLord). Код пошаговой анимации в `array` (`code:`) не
  выполняется — это чужой JS из репозитория, показывается текстом.
