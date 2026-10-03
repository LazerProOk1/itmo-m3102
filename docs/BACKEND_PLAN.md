# План бэкенда сайта М3102

Документ — инструкция и план на будущее: зачем сайту сервер, что он даст, как его построить и в каком порядке
делать. Сейчас сайт полностью статический (GitHub Pages): данные группы берутся из репозиториев на GitHub, всё личное
хранится в `localStorage` браузера. Бэкенд это не ломает, а дополняет.

## Главный принцип: сайт работает и без регистрации

- **Гость** (не вошёл) видит всё то же, что сейчас: расписание, конспекты, тесты, дедлайны, ДЗ, материалы, мемы,
  ссылки, игру. Личное (учебный план, отметки «сделано», результаты тестов, пометки) хранится в браузере, как сейчас.
- **Вход нужен только для действий от своего имени и для синхронизации между устройствами**: записаться в очередь на
  сдачу, загрузить мем, получить уведомления, увидеть свои оценки из БАРС, редактировать данные группы (по роли).
- **Если сервер недоступен** — сайт продолжает работать как сейчас (статика + офлайн через service worker). Каждая
  функция бэкенда — надстройка: нет ответа API → прячем кнопку или показываем данные из GitHub/кеша.

## Почему Go

Да, Go здесь хороший выбор:

| Критерий | Go |
|---|---|
| Готовая работа с ИТМО | Есть [kewldan/go-itmo](https://github.com/kewldan/go-itmo) (MIT): клиенты ITMO.ID, my.itmo (~450 маршрутов), БАРС — на Go |
| Развёртывание | Один бинарник, Docker-образ ~20 МБ, мало памяти — хватит самого дешёвого сервера |
| Стандартная библиотека | `net/http` с маршрутами по методу и шаблону (`GET /api/memes/{id}`) — роутер-библиотека не обязательна |
| Порог входа | Язык простой и строгий, код легко читать через полгода и передать следующему курсу |
| Альтернативы | Python (FastAPI) — быстрее начать, но тяжелее деплой; Kotlin/Java — есть [my-itmo-api](https://github.com/alllexey-dev/my-itmo-api), но больше кода; Node — один язык с фронтом, но слабее типизация данных БД |

Итог: **Go + PostgreSQL**, один сервис (монолит). Микросервисы, очереди и Kubernetes для группы из ~30 человек не нужны.

## ITMO ID: как устроен вход и что реально можно

### Как это работает у my.itmo

- ITMO.ID — это Keycloak, OpenID Connect. Провайдер: `https://id.itmo.ru/auth/realms/itmo`
  (токены — `…/protocol/openid-connect/token`).
- my.itmo входит как клиент `student-personal-cabinet` с PKCE, адрес возврата — `https://my.itmo.ru/login/callback`.
- access-токен живёт несколько минут, refresh-токен **меняется при каждом обновлении** (rotation) — его надо сохранять
  каждый раз заново.
- API my.itmo принимает `Authorization: Bearer <access_token>`. Пример: личное расписание —
  `GET https://my.itmo.ru/api/schedule/schedule/personal?date_start=YYYY-MM-DD&date_end=YYYY-MM-DD`.

(Источники: [kewldan/go-itmo](https://github.com/kewldan/go-itmo), [Ivan-Sysoev/itmo-auth](https://github.com/Ivan-Sysoev/itmo-auth).)

### Что из этого следует для нас

1. **Чужой клиент `student-personal-cabinet` нам не подходит**: его адрес возврата закреплён за `my.itmo.ru`, к нам
   браузер пользователя не вернётся. Неофициальные библиотеки обходят это, отправляя логин и пароль студента с сервера
   в форму входа. **Так не делаем**: пароль от ITMO ID на наш сервер не принимаем — это доступ ко всей учёбе человека,
   а мы становимся тем, кто за него отвечает.
2. **Правильный путь — свой OIDC-клиент в ITMO.ID.** Нужна заявка в ИТМО (команда ITMO.ID / департамент
   информационных технологий): клиент `m3102-site`, тип confidential, Authorization Code + PKCE, адрес возврата
   `https://api.<наш-домен>/auth/itmo/callback`, scope `openid profile` (+ группа студента, если её отдают в токене).
   **Уточнить у ИТМО**: дают ли клиенты студенческим проектам, какие claims доступны (ИСУ, ФИО, группа), можно ли
   с этим токеном обращаться к API my.itmo/БАРС (audience) — или это отдельное согласование.
   **Вариант Б — go-itmo с паролем (если ИТМО откажет, а группа сознательно согласна).** Технически это
   работает: студент вводит логин и пароль ITMO ID на нашей странице, сервер через [go-itmo](https://github.com/kewldan/go-itmo)
   проходит форму входа (с OTP, если он включён), получает refresh-токен, а пароль сразу забывает. Дальше сервер
   хранит только зашифрованный refresh-токен и обновляет его. Риски, из-за которых это не основной путь:
   - пароль от всей учёбы проходит через наш сервер — доказать, что мы его не сохранили, невозможно;
   - студентов приучаем вводить пароль ИТМО на чужом сайте — ровно то, на чём работает фишинг;
   - это неофициальный клиент чужой учётной записи (`student-personal-cabinet`): ИТМО может в любой момент
     поменять форму входа или заблокировать такие запросы, и всё сломается;
   - по 152-ФЗ мы становимся оператором персональных данных с паролем-ключом к ним.
   Если всё же делать: только как необязательное «Подключить my.itmo» (а не вход на сайт), с явным предупреждением,
   без сохранения пароля даже в логах, с кнопкой «отключить и удалить токен».
3. **Пока клиента нет** — вход через Telegram ([Login Widget](https://core.telegram.org/widgets/login)) или GitHub
   OAuth, а принадлежность к группе подтверждает админ (приглашение по ссылке-коду). Когда появится ITMO ID —
   привязываем его к тем же аккаунтам (таблица `identities`), ничего не теряется.

### Что можно подтягивать с ITMO ID / my.itmo (если ИТМО разрешит доступ к API)

| Данные | Зачем на сайте | Видимость |
|---|---|---|
| ФИО, ИСУ, группа | Аккаунт, автоматическая проверка «студент М3102» и роль | Имя — группе, ИСУ — никому |
| Личное расписание | Официальные переносы, замены аудиторий, перевод в календарь | Только владельцу; общее расписание группы можно собирать из него и сравнивать с `data/schedule.json` |
| Баллы БАРС по предметам | «Сколько набрано / сколько до 60» на странице предмета, рядом с прогрессом тестов | Строго лично |
| Учебный план, дисциплины, преподаватели | Автозаполнение предметов и контактов | Группе |
| Бронирование аудиторий (`booking` в go-itmo) | Забронировать переговорку для подготовки группой | По роли |
| Электронные очереди, справки | Ссылки и статусы | Лично |

Всё это — только с явного согласия пользователя (галочка «подтянуть мои данные из my.itmo»), с возможностью
отозвать и удалить.

## Что даст бэкенд (полный список)

### 1. Аккаунты и роли

- Роли: **гость** (без входа) → **студент** (вошёл, подтверждён как М3102) → **редактор** (староста и помощники:
  расписание, ДЗ, дедлайны, ссылки) → **админ** (выдаёт роли, модерирует, видит журнал действий).
- Админ выдаёт роли в админке; первый админ задаётся переменной окружения при развёртывании.
- Сессия — cookie `HttpOnly; Secure; SameSite=Lax`, хранится на сервере (таблица `sessions`), можно выйти со всех
  устройств.

### 2. Синхронизация личного между устройствами

То, что сейчас лежит в `localStorage` (`m3102:*`): учебный план, отметки «сделано» у дедлайнов и ДЗ, результаты тестов
и повторение ошибок, закладки и пометки, заметки, настройки оформления.

- При первом входе — предложить «перенести данные с этого устройства» (загрузить локальное на сервер).
- Дальше zustand-хранилища сохраняются и на сервер (debounce ~1 с), при открытии сайта — подтягиваются.
- Конфликты: по каждому ключу «последняя запись побеждает» (`updated_at`); для списков (пометки, задачи) — слияние по
  `id`. Для группы этого достаточно.

### 3. Публикация без токена GitHub в браузере

Сейчас редактирование ДЗ и мемов публикуется в репозиторий через личный PAT, который хранится в браузере
(`services/github.ts`). С бэкендом:

- **GitHub App** с правом `contents: write` на репозиторий, сервер коммитит от имени приложения, в сообщении коммита —
  кто из группы внёс правку. PAT в браузере больше не нужен.
- Формат файлов (`data/homework.json`, `Дедлайны/deadlines.json`, `data/links.json`) **не меняется** — сайт
  RedstoneLord продолжает их читать. Ставить приложение на `RedstoneLord/itmo-m3102` — только с его согласия; до этого —
  на наш форк.
- Библиотеки: [google/go-github](https://github.com/google/go-github), [bradleyfalzon/ghinstallation](https://github.com/bradleyfalzon/ghinstallation).

### 4. Кеш контента и обход лимита GitHub

- Сервер забирает дерево репозиториев (группы и потока) по **webhook** на push и раз в N минут, хранит у себя и отдаёт
  сайту одним запросом `GET /api/content?since=…` (только изменённое).
- Лимит GitHub API без токена (60 запросов в час на IP) перестаёт касаться студентов.
- Поиск по PDF — индекс строится на сервере, а не в каждом браузере.

### 5. Мемы

- Загрузка картинки с телефона: `POST /api/memes` (multipart) → проверка типа и размера → уменьшение и сжатие →
  S3-совместимое хранилище → ссылка.
- Модерация: новый мем виден автору и редакторам, публикуется после одобрения (или сразу — настройка в админке).
- Лайки, подписи, теги, автор; удаление своего мема; жалоба.
- Хранилище: Yandex Object Storage или MinIO на том же сервере; библиотеки [minio/minio-go](https://github.com/minio/minio-go),
  [disintegration/imaging](https://github.com/disintegration/imaging).

### 6. Дедлайны и очередь на сдачу

Сейчас очередь — это issues с меткой `queue-signup` в репозитории группы (нужен аккаунт GitHub, issue создаётся руками).

- Записаться в очередь одной кнопкой, видеть свой номер, выйти из очереди; преподаватель или староста отмечает «сдал».
- Таймслоты (если сдача по времени), лимит мест, перенос.
- Дедлайны: личные отметки «сделано» синхронизируются; староста добавляет дедлайны в админке, сервер дописывает их в
  `Дедлайны/deadlines.json`.
- Переход: на время перехода сервер читает и старые issues, чтобы очередь не потерялась.

### 7. Уведомления

- **Telegram-бот** (привязка аккаунта через `/start <код>`): «завтра дедлайн», «пару перенесли», «новый конспект по
  предмету», «твоя очередь через 2 человека», напоминание о повторении тестов. Библиотека
  [go-telegram/bot](https://github.com/go-telegram/bot).
- **Web Push** (PWA уже есть: `public/sw.js`, `manifest.webmanifest`) — те же уведомления без Telegram.
- Настройки: что присылать и в какое время (тихие часы).

### 8. Календарь-подписка

- Личная ссылка `https://api.<домен>/ical/<секрет>.ics`: пары (с переносами), дедлайны, личные задачи → подписка в
  Google/Apple/Яндекс Календаре. Секрет можно перевыпустить.
- Библиотека [arran4/golang-ical](https://github.com/arran4/golang-ical); идеи — [anton-ozerov/itmo-to-google-cal](https://github.com/anton-ozerov/itmo-to-google-cal),
  [Cirilus/itmo-calendar-sync](https://github.com/Cirilus/itmo-calendar-sync).

### 9. Админка

Отдельный раздел сайта `#/admin` (виден только редакторам и админам), без отдельного приложения:

- Пользователи: список, роли, приглашения, блокировка.
- Расписание: переносы и отмены пар (сейчас — в `react-app-dev` с PAT), объявления на главной.
- Дедлайны и ДЗ: создание и правка (с публикацией в репозиторий через GitHub App).
- Мемы и ссылки: модерация, жалобы.
- Журнал действий (кто, что, когда) — для любого изменения общих данных.
- Статистика тестов по группе (обезличенно): какие вопросы чаще всего решают неверно — подсказка, что разобрать.

### 10. Ещё полезное

- Опросы и голосования группы (время консультации, выбор темы).
- Общий учебный план группы (не только личный).
- Обезличенный рейтинг «кто сколько тестов прошёл» — только с согласия участника (opt-in).
- Ответы на вопросы по конспектам (комментарии к разделам) — после модерации.

## Архитектура

```
Браузер (GitHub Pages / свой домен)
   │  fetch + cookie сессии (тот же сайт: m3102.ru и api.m3102.ru)
   ▼
Go API (один бинарник)  ── PostgreSQL (всё, кроме файлов)
   │                     ── S3-хранилище (мемы)
   ├── ITMO.ID (OIDC) / Telegram / GitHub OAuth — вход
   ├── my.itmo / БАРС — личные данные (с согласия)
   ├── GitHub App — чтение и публикация данных группы
   └── Telegram Bot API, Web Push — уведомления
```

### Важно: один «сайт» для фронта и API

Cookie сессии между `lazerprook1.github.io` и чужим доменом API — это сторонние cookie, которые Safari и Chrome
блокируют. Поэтому нужен **свой домен**: фронт на `m3102.<домен>` (GitHub Pages умеет свой домен), API на
`api.m3102.<домен>` — это один сайт для браузера, cookie с `SameSite=Lax` работают. Хранить токены в `localStorage`
вместо cookie — не надо: любая XSS их унесёт.

### Стек

| Задача | Выбор |
|---|---|
| HTTP | стандартный `net/http` (Go 1.22+ умеет `GET /path/{id}`); при желании [go-chi/chi](https://github.com/go-chi/chi) |
| OIDC / OAuth | [coreos/go-oidc](https://github.com/coreos/go-oidc) + [golang/oauth2](https://github.com/golang/oauth2) |
| ITMO.ID, my.itmo, БАРС | [kewldan/go-itmo](https://github.com/kewldan/go-itmo) — как библиотека или как справочник по маршрутам |
| PostgreSQL | [jackc/pgx](https://github.com/jackc/pgx) + [sqlc-dev/sqlc](https://github.com/sqlc-dev/sqlc) (типобезопасные запросы из SQL) |
| Миграции | [pressly/goose](https://github.com/pressly/goose) (SQL-файлы в репозитории) |
| Контракт API | OpenAPI 3: [oapi-codegen/oapi-codegen](https://github.com/oapi-codegen/oapi-codegen) для Go, типы для фронта — из той же схемы |
| CORS | [rs/cors](https://github.com/rs/cors) (только наш домен, с `credentials`) |
| CSRF | `SameSite=Lax` + проверка заголовка `Origin` на изменяющих запросах; при необходимости [gorilla/csrf](https://github.com/gorilla/csrf) |
| Файлы | S3: [minio/minio-go](https://github.com/minio/minio-go); картинки — [disintegration/imaging](https://github.com/disintegration/imaging) |
| GitHub | [google/go-github](https://github.com/google/go-github) + [bradleyfalzon/ghinstallation](https://github.com/bradleyfalzon/ghinstallation) |
| Telegram | [go-telegram/bot](https://github.com/go-telegram/bot) |
| Календарь | [arran4/golang-ical](https://github.com/arran4/golang-ical) |
| Тесты | стандартный `testing` + [testcontainers/testcontainers-go](https://github.com/testcontainers/testcontainers-go) (настоящий Postgres в тестах) |
| Метрики | [prometheus/client_golang](https://github.com/prometheus/client_golang) — по желанию |
| HTTPS и прокси | [caddyserver/caddy](https://github.com/caddyserver/caddy) — сертификаты сам |

Redis не нужен: сессии, очередь задач и кеш спокойно живут в PostgreSQL при нашей нагрузке.

### Структура проекта

Папка `backend/` в этом же репозитории (типы API общие с фронтом, одна история изменений):

```
backend/
  cmd/api/main.go            запуск: конфиг из env, миграции, HTTP-сервер, фоновые задачи
  internal/auth/             OIDC (ITMO.ID), Telegram, GitHub OAuth, сессии, роли, middleware
  internal/itmo/             обёртка над my.itmo/БАРС: расписание, баллы (с согласия), шифрование токенов
  internal/content/          синхронизация репозиториев группы, webhook, кеш, индекс поиска
  internal/publish/          GitHub App: запись deadlines.json, homework.json, links.json
  internal/state/            личные данные пользователя (бывший localStorage)
  internal/memes/            загрузка, обработка, модерация, лайки
  internal/deadlines/        очереди на сдачу, отметки
  internal/notify/           Telegram-бот, Web Push, расписание рассылок
  internal/ical/             календарь-подписка
  internal/admin/            роли, приглашения, журнал действий
  internal/db/               сгенерированный sqlc-код
  migrations/                SQL-миграции goose
  api/openapi.yaml           контракт API
  sqlc.yaml  Dockerfile  compose.yaml  .env.example
```

### База данных (основные таблицы)

```sql
users          (id, display_name, group_code, status, created_at)
identities     (user_id, provider /* itmo|telegram|github */, subject, created_at)   -- один человек, несколько способов входа
roles          (user_id, role /* student|editor|admin */, granted_by, granted_at)
invites        (code, role, created_by, expires_at, used_by)
sessions       (id_hash, user_id, user_agent, created_at, last_seen_at, expires_at)
itmo_tokens    (user_id, refresh_token_enc, scope, updated_at)   -- только с согласия, зашифровано (AES-GCM)
user_state     (user_id, key /* tasks|quizzes|marks|... */, value jsonb, updated_at)
deadline_queue (deadline_id, user_id, position, status /* waiting|done|left */, created_at)
memes          (id, author_id, object_key, width, height, caption, status /* pending|published|hidden */, created_at)
meme_likes     (meme_id, user_id)
notify_settings(user_id, channel /* telegram|push */, target, kinds text[], quiet_from, quiet_to)
push_subs      (user_id, endpoint, p256dh, auth)
ical_feeds     (user_id, secret_hash, created_at)
audit_log      (id, actor_id, action, entity, entity_id, diff jsonb, created_at)
content_cache  (repo, path, sha, body, fetched_at)
```

### API (набросок)

```
GET    /api/health
GET    /api/me                               кто я, роли (401 — гость)
GET    /auth/itmo/login  → /auth/itmo/callback   вход через ITMO.ID
GET    /auth/telegram/callback, /auth/github/callback
POST   /auth/logout   POST /auth/logout-all
GET    /api/content?since=                   данные группы из кеша
GET    /api/state           PUT /api/state/{key}        личное (синхронизация)
GET    /api/itmo/schedule?from=&to=          личное расписание (с согласия)
GET    /api/itmo/scores                      баллы БАРС (с согласия)
GET    /api/deadlines/{id}/queue   POST .../queue   DELETE .../queue   PATCH .../queue/{userId}
GET    /api/memes   POST /api/memes   POST /api/memes/{id}/like   DELETE /api/memes/{id}
POST   /api/publish/homework | deadlines | links      (редактор) → коммит в репозиторий
GET    /api/admin/users   PUT /api/admin/users/{id}/roles   POST /api/admin/invites
GET    /api/admin/audit
POST   /api/notify/telegram/link   POST /api/push/subscribe
GET    /ical/{secret}.ics
POST   /webhooks/github                      push в репозиторий группы → обновить кеш
```

## Безопасность и закон

- **152-ФЗ «О персональных данных»**: ФИО, ИСУ, оценки — персональные данные граждан РФ; их запись и хранение должны
  быть в базах на территории России. Значит, сервер и база — у российского хостинга (Yandex Cloud, Selectel, Timeweb
  Cloud и т. п.). Нужны политика конфиденциальности на сайте и согласие при входе.
- Собираем минимум: без паспортов, телефонов и т. п. Оценки — только владельцу, никогда в общих данных.
- Токены ITMO.ID — зашифрованы ключом из переменной окружения; refresh-токен перезаписывается при каждом обновлении;
  удаление аккаунта удаляет всё.
- Пароли от ITMO ID на сервер не принимаем ни в каком виде.
- Ограничение частоты запросов (на вход, загрузку мемов, запись в очередь), проверка типа файлов по содержимому.
- Все изменения общих данных — в журнал действий.
- Секреты (`GITHUB_APP_KEY`, `OIDC_CLIENT_SECRET`, `SESSION_KEY`, `TELEGRAM_TOKEN`) — только в переменных окружения
  сервера и в GitHub Secrets для CI, никогда в репозитории.
- Резервные копии базы — ежедневно (`pg_dump` в объектное хранилище), проверка восстановления раз в семестр.

## Развёртывание

- **Вариант 1 (проще всего): VPS** у российского хостинга, 1 vCPU / 1–2 ГБ: `compose.yaml` с Go API, PostgreSQL,
  MinIO и Caddy (HTTPS сам). Обновление — `docker compose pull && docker compose up -d` из GitHub Actions по SSH.
- **Вариант 2: Yandex Cloud** — Serverless Containers (API), Managed PostgreSQL, Object Storage (мемы). Дороже в
  настройке, зато без администрирования сервера.
- Домен: `m3102.<домен>` → GitHub Pages (CNAME), `api.m3102.<домен>` → сервер.
- CI: `go vet`, тесты (с testcontainers), сборка образа; фронт — как сейчас.

## Изменения во фронтенде

- `VITE_API_URL` в `.env`; если не задан или API не отвечает — сайт работает как сейчас.
- `services/api.ts`: `fetch` с `credentials: 'include'`, типы из OpenAPI.
- Кнопка «Войти» в меню пользователя; страница профиля (способы входа, согласия, Telegram, календарь, удалить аккаунт).
- Хранилища zustand получают «синхронизатор» для вошедших.
- `services/github.ts` (PAT) остаётся только для режима без сервера; при входе публикация идёт через `/api/publish/*`.
- Очередь на сдачу, мемы, админка — новые экраны поверх API.

## План работ по этапам

| Этап | Что делаем | Результат |
|---|---|---|
| 0. Подготовка | Домен, хостинг, `backend/` с каркасом, CI, `openapi.yaml`, миграции, `/api/health` | Сервер отвечает, фронт видит `VITE_API_URL` |
| 1. Аккаунты | Вход через Telegram/GitHub, приглашения, роли, сессии, `/api/me`, кнопка «Войти» | Можно войти; гость не замечает разницы |
| 2. Синхронизация | `user_state`, перенос `localStorage`, синхронизация хранилищ | План, отметки, тесты, пометки на всех устройствах |
| 3. Публикация | GitHub App, `/api/publish/*`, журнал действий, админка (роли, ДЗ, дедлайны, расписание) | PAT в браузере больше не нужен |
| 4. Мемы и очереди | Загрузка мемов, модерация, лайки; очередь на сдачу вместо issues | Мемы с телефона, очередь одной кнопкой |
| 5. Уведомления | Telegram-бот, Web Push, календарь-подписка | Напоминания о дедлайнах и переносах |
| 6. ITMO.ID | Заявка на OIDC-клиент (начать на этапе 0 — ответ может идти долго), вход, проверка группы, расписание и баллы с согласия | Вход через ITMO ID, личные данные из my.itmo |
| 7. Шлифовка | Метрики, бэкапы, нагрузочная проверка, документация для следующего курса | Можно передать проект |

Этап 6 зависит от ответа ИТМО, поэтому заявку подаём сразу, а остальное делаем параллельно.

## Полезные репозитории

### Наши и группы

- [LazerProOk1/itmo-m3102](https://github.com/LazerProOk1/itmo-m3102) — этот сайт (React), форк.
- [RedstoneLord/itmo-m3102](https://github.com/RedstoneLord/itmo-m3102) — репозиторий группы: конспекты, дедлайны,
  ДЗ, ссылки, сайт старосты. Источник данных; форматы файлов не менять.
- [Kefirleos/itmo-vault](https://github.com/Kefirleos/itmo-vault) — конспекты 1 потока.

### ITMO.ID, my.itmo, БАРС (неофициальные — только как справочник по API)

- [kewldan/go-itmo](https://github.com/kewldan/go-itmo) — Go: ITMO.ID, my.itmo (~450 маршрутов), БАРС, QR-пропуск. MIT.
- [Ivan-Sysoev/itmo-auth](https://github.com/Ivan-Sysoev/itmo-auth) — Python: обновление токена ITMO.ID, расписание.
- [alllexey-dev/my-itmo-api](https://github.com/alllexey-dev/my-itmo-api) и [deminearchiver-ru/my-itmo-api](https://github.com/deminearchiver-ru/my-itmo-api) — Java-клиенты my.itmo.
- [anton-ozerov/itmo-to-google-cal](https://github.com/anton-ozerov/itmo-to-google-cal) — расписание my.itmo → iCalendar. MIT.
- [Cirilus/itmo-calendar-sync](https://github.com/Cirilus/itmo-calendar-sync) — Rust: расписание → подписка iCalendar.
- [AlanTheKnight/itmo-schedule](https://github.com/AlanTheKnight/itmo-schedule) — SPA + бэкенд экспорта расписания (AGPL-3.0 — код не копировать в наш проект без той же лицензии).
- [S-txt/my.itmo-schedule-exporter](https://github.com/S-txt/my.itmo-schedule-exporter) — расширение браузера для экспорта расписания.
- [kysect/itmo-schedule-sdk](https://github.com/kysect/itmo-schedule-sdk) — SDK расписания (архив, только для истории).

### Библиотеки Go

- Вход: [coreos/go-oidc](https://github.com/coreos/go-oidc), [golang/oauth2](https://github.com/golang/oauth2)
- HTTP: [go-chi/chi](https://github.com/go-chi/chi) (необязательно), [rs/cors](https://github.com/rs/cors), [gorilla/csrf](https://github.com/gorilla/csrf)
- База: [jackc/pgx](https://github.com/jackc/pgx), [sqlc-dev/sqlc](https://github.com/sqlc-dev/sqlc), [pressly/goose](https://github.com/pressly/goose) (или [golang-migrate/migrate](https://github.com/golang-migrate/migrate))
- API: [oapi-codegen/oapi-codegen](https://github.com/oapi-codegen/oapi-codegen)
- Файлы: [minio/minio-go](https://github.com/minio/minio-go), [disintegration/imaging](https://github.com/disintegration/imaging)
- GitHub: [google/go-github](https://github.com/google/go-github), [bradleyfalzon/ghinstallation](https://github.com/bradleyfalzon/ghinstallation)
- Уведомления: [go-telegram/bot](https://github.com/go-telegram/bot)
- Календарь: [arran4/golang-ical](https://github.com/arran4/golang-ical)
- Тесты и метрики: [testcontainers/testcontainers-go](https://github.com/testcontainers/testcontainers-go), [prometheus/client_golang](https://github.com/prometheus/client_golang)
- Сервер: [caddyserver/caddy](https://github.com/caddyserver/caddy)

### Документация

- [Telegram Login Widget](https://core.telegram.org/widgets/login) — вход через Telegram до появления ITMO ID.
- [GitHub Apps](https://docs.github.com/en/apps) — публикация в репозиторий без личного токена.
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html) и [PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636).
- [Web Push (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Push_API).

## Открытые вопросы

- Дадут ли ИТМО отдельный OIDC-клиент студенческому проекту и с какими правами (claims, доступ к API my.itmo/БАРС).
- Согласие RedstoneLord на GitHub App в его репозитории (или публикуем только в форк).
- Кто платит за сервер и домен и кто станет вторым админом, чтобы проект не зависел от одного человека.
- Нужна ли модерация мемов до публикации или достаточно жалоб.
