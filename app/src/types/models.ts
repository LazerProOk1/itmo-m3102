/**
 * Модель данных приложения.
 * Типы добавляются сюда по мере создания разделов (полный черновик — в docs/ARCHITECTURE.md).
 */

/** Уникальный идентификатор, создаётся через crypto.randomUUID() */
export type ID = string;

/** Дата без времени: "2026-09-15" */
export type ISODate = string;

/** Дата и время: "2026-09-15T10:00:00.000Z" */
export type ISODateTime = string;

/**
 * Общие поля любой записи (предмет, задача, заметка...).
 * updatedAt понадобится для синхронизации: при конфликте побеждает более свежая версия.
 */
export interface BaseEntity {
  id: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Один контакт предмета: за какую часть занятий отвечает и как с ним связаться */
export interface SubjectContact {
  /** Тип занятия — те же значения, что и у ClassSession/ClassDetails */
  role: ClassType;
  teacherName: string;
  email?: string;
  /** Username или ссылка на Telegram, например "@ivanova" или "https://t.me/ivanova" */
  telegram?: string;
}

export interface Subject extends BaseEntity {
  name: string;
  /** Основной преподаватель — для компактных списков (страница Subjects) и как запасной вариант в контактах */
  teacherPrimary?: string;
  /** Ссылка или username общего Telegram-чата группы по предмету */
  telegramChatUrl?: string;
  /**
   * Контакты по ролям (лекция/лабораторная/...), заполненные вручную.
   * Используются, только если у предмета ещё нет занятий в расписании — иначе список
   * вычисляется из реального расписания (см. getSubjectContacts), а эти записи остаются
   * источником email/telegram для того же преподавателя.
   */
  contacts?: SubjectContact[];
  archived: boolean;
}

/* ---------- Расписание ---------- */

/** День недели: 1 — понедельник … 7 — воскресенье */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ClassType = 'lecture' | 'lab' | 'seminar' | 'practice';

/** 1 — нечётная неделя, 2 — чётная, см. lib/studyWeek.ts */
export type WeekInCycle = 1 | 2;

/** Как часто повторяется занятие: каждую неделю или только на конкретной неделе цикла */
export type WeekRepeat = 'every' | WeekInCycle;

/** Всё, что описывает одно занятие, кроме того, когда оно повторяется */
export interface ClassDetails {
  subjectId: ID;
  /** Время в формате "10:00" */
  startTime: string;
  endTime: string;
  type: ClassType;
  room?: string;
  /** Корпус/адрес, если он не очевиден из аудитории, например "Кронверкский пр., д.49, лит.А" */
  building?: string;
  /** У одного предмета лекции, практики и лабораторные часто ведут разные люди — привязан к занятию, не к предмету */
  teacher: string;
  /** Подгруппа или группа, если занятие идёт не для всего потока, например "Лин.Алг. 1.2" */
  subgroup?: string;
  link?: string;
  notes?: string;
}

/** Регулярное занятие: повторяется в указанный день недели */
export interface ClassSession extends BaseEntity, ClassDetails {
  weekday: Weekday;
  weeks: WeekRepeat;
}

interface ScheduleExceptionBase extends BaseEntity {
  /** Пояснение, например «Teacher is at a conference» */
  note?: string;
}

/** Занятие отменено в конкретную дату */
export interface CancelledClass extends ScheduleExceptionBase {
  kind: 'cancelled';
  classId: ID;
  /** Дата, на которую было запланировано регулярное занятие */
  date: ISODate;
}

/** Занятие перенесено на другой день или время */
export interface MovedClass extends ScheduleExceptionBase {
  kind: 'moved';
  classId: ID;
  date: ISODate;
  newDate: ISODate;
  startTime: string;
  endTime: string;
  room?: string;
  /** Если при переносе сменился и преподаватель. Не указано — значит, ведёт тот же, что и обычно. */
  teacherOverride?: string;
}

/** Вместо регулярного занятия проходит другое */
export interface ReplacedClass extends ScheduleExceptionBase {
  kind: 'replaced';
  classId: ID;
  date: ISODate;
  details: ClassDetails;
}

/** Дополнительное разовое занятие */
export interface AdditionalClass extends ScheduleExceptionBase {
  kind: 'additional';
  date: ISODate;
  details: ClassDetails;
}

/** Изменение расписания в конкретную дату. Всегда важнее регулярного расписания. */
export type ScheduleException = CancelledClass | MovedClass | ReplacedClass | AdditionalClass;

/* ---------- Задачи и материалы ---------- */

export type TaskType = 'homework' | 'lab' | 'project' | 'preparation' | 'exam' | 'other';

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task extends BaseEntity {
  title: string;
  subjectId?: ID;
  type: TaskType;
  /** Срок сдачи. Не у каждой задачи он есть. */
  deadline?: ISODate;
  priority: TaskPriority;
  status: TaskStatus;
  description?: string;
  /** Ссылки на материалы к задаче. Пустой массив, если ссылок нет. */
  links: string[];
}

export type MaterialType = 'pdf' | 'document' | 'presentation' | 'image' | 'link' | 'google_drive' | 'google_docs' | 'other';

/** Категория материала — независима от MaterialType (PDF может быть и «Литературой», и «Заданием») */
export type MaterialCategory = 'literature' | 'assignments' | 'presentations' | 'other';

export interface Material extends BaseEntity {
  name: string;
  subjectId?: ID;
  /** Раньше материалов без категории не было — optional, чтобы старые записи в localStorage не ломались */
  category?: MaterialCategory;
  /** type: 'link' — это и есть «быстрые ссылки» на странице предмета, отдельной сущности для них нет */
  type: MaterialType;
  url: string;
  description?: string;
}

export interface Note extends BaseEntity {
  title: string;
  subjectId?: ID;
  content: string;
}

/**
 * markdown — content хранит текст; pdf — content хранит либо data: URI (загружен локально,
 * только для небольших файлов), либо ссылку на файл в Google Drive; link — content хранит URL.
 */
export type LectureNoteContentType = 'markdown' | 'pdf' | 'docx' | 'link';

/** Откуда взялась запись: вручную создана в приложении или подтянута синхронизацией с GitHub (PROMPT 25) */
export type ContentSource = 'manual' | 'github';

/** Конспект лекции — отдельная от Material сущность с текстом, как у Note, но привязанная к номеру занятия */
export interface LectureNote extends BaseEntity {
  subjectId: ID;
  /** Например, "Лекция 1", "Практика 3" */
  lectureNumber: string;
  title: string;
  contentType: LectureNoteContentType;
  content: string;
  /** Когда конспект последний раз открывали — для блока «Продолжить чтение» */
  lastOpenedAt?: ISODateTime;
  source: ContentSource;
  /** Путь к файлу в репозитории — только у source: 'github' */
  sourceRef?: string;
  /** Файл удалили из репозитория при следующей синхронизации — запись не удаляем, а прячем */
  archived: boolean;
  /** Версия файла в GitHub (sha) — не менялся, и при синхронизации его не качаем заново */
  sourceVersion?: string;
}

/**
 * Нелекционный контент предмета, синхронизированный из GitHub: описание курса, правила
 * аттестации, полезные ссылки — то, что не привязано к конкретному занятию (PROMPT 25).
 */
export type SubjectInfoCategory = 'description' | 'rules' | 'links' | 'other';

export interface SubjectInfo extends BaseEntity {
  subjectId: ID;
  title: string;
  content: string;
  category: SubjectInfoCategory;
  source: ContentSource;
  sourceRef?: string;
  sourceVersion?: string;
  archived: boolean;
}

/* ---------- Календарь ---------- */

/**
 * Обычное событие на календаре — не занятие и не задача (день рождения, встреча, экзамен-мероприятие).
 * Без startTime/endTime событие показывается как «весь день».
 */
export interface Event extends BaseEntity {
  title: string;
  date: ISODate;
  startTime?: string;
  endTime?: string;
  description?: string;
}

/* ---------- Настройки ---------- */

/** Настройка интерфейса конкретного браузера — не пользовательские данные, см. settingsStore */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Настройка семестра, общая для всех пользователей, см. semesterSettingsStore */
export type TimeFormat = '24h' | '12h';
