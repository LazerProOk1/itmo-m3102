import type { ClassSession, ClassType, Subject, WeekRepeat, Weekday } from '../types/models';

/** Расписание и предметы группы М3102 */

const SEED_TIME = '2026-09-01T00:00:00.000Z';
const KRONVERKSKY = 'Кронверкский пр., д.49, лит.А';

export const M3102_SUBJECTS: Subject[] = [
  { id: 'aisd', name: 'Алгоритмы и структуры данных', teacherPrimary: 'Ткаченко Данил Михайлович' },
  { id: 'dm', name: 'Дискретная математика', teacherPrimary: 'Чухарев Константин Игоревич' },
  { id: 'isrpo', name: 'Инструментальные средства разработки ПО', teacherPrimary: 'Койнов Руслан Васильевич' },
  { id: 'linal', name: 'Линейная алгебра', teacherPrimary: 'Ржонсицкая Юлия Борисовна' },
  { id: 'matan', name: 'Математический анализ', teacherPrimary: 'Ржонсицкая Юлия Борисовна' },
  { id: 'op', name: 'Основы программирования', teacherPrimary: 'Хвастунов Александр Павлович' },
].map((subject) => ({ ...subject, archived: false, createdAt: SEED_TIME, updatedAt: SEED_TIME }));

/** Сокращённые папки предметов в репозитории группы (Материалы/ДМ, Записи лекций/ОП…) → id предмета */
export const SUBJECT_FOLDERS: Record<string, string> = {
  АиСД: 'aisd',
  ДМ: 'dm',
  ИСРПО: 'isrpo',
  Линал: 'linal',
  Матан: 'matan',
  ОП: 'op',
};

const normalizeName = (value: string) => value.replace(/_/g, ' ').trim().toLowerCase().replace(/ё/g, 'е');

/**
 * id предмета по имени папки: "ДМ", "Линейная_Алгебра", "Алгоритмы_и_структуры_данных",
 * "Линейная алгебра и геометрия" — сокращение, полное имя (подчёркивания = пробелы) или имя из потока.
 */
export function resolveSubjectFolder(folder: string): string | undefined {
  const key = normalizeName(folder);
  const byAbbreviation = Object.entries(SUBJECT_FOLDERS).find(([name]) => normalizeName(name) === key);
  if (byAbbreviation) return byAbbreviation[1];
  const byName = M3102_SUBJECTS.find((subject) => normalizeName(subject.name) === key);
  if (byName) return byName.id;
  return Object.entries(STREAM_SUBJECT_FOLDERS).find(([name]) => normalizeName(name) === key)?.[1];
}

/** Названия предметов в описаниях курсов (`src/data/courseInfo`, 1 поток) → id предмета */
export const STREAM_SUBJECT_FOLDERS: Record<string, string> = {
  'Алгоритмы и структуры данных': 'aisd',
  'Дискретная математика': 'dm',
  'Инструментальные средства разработки ПО': 'isrpo',
  'Линейная алгебра и геометрия': 'linal',
  'Математический анализ': 'matan',
  'Основы программирования': 'op',
};

type Row = [weekday: Weekday, weeks: WeekRepeat, start: string, end: string, subjectId: string, type: ClassType, room: string, teacher: string];

// Запасное расписание до первой синхронизации — дальше берётся data/schedule.json с сайта группы
// (services/groupSchedule.ts). weeks: 1 — нечётная, 2 — чётная, чётность как на сайте группы.
// Тип занятия — по цвету в расписании ИТМО: синий — лекция, жёлтый — практика, фиолетовый — лабораторная.
const ROWS: Row[] = [
  [2, 'every', '09:50', '11:20', 'dm', 'lecture', '2304', 'Чухарев Константин Игоревич'],
  [2, 'every', '11:30', '13:00', 'linal', 'lecture', '2304', 'Ржонсицкая Юлия Борисовна'],
  [3, 'every', '13:30', '15:00', 'dm', 'lab', '2240', 'Кулешова Екатерина Дмитриевна'],
  [3, 'every', '15:30', '17:00', 'aisd', 'lab', '2240', 'Кулешова Екатерина Дмитриевна'],
  [4, 'every', '09:50', '11:20', 'linal', 'practice', '2430', 'Бровкина Екатерина Анатольевна'],
  [4, 1, '11:30', '13:00', 'linal', 'practice', '2430', 'Бровкина Екатерина Анатольевна'],
  [5, 'every', '11:30', '13:00', 'isrpo', 'practice', '2238', 'Хегай Максим Вилорьевич'],
  [5, 'every', '13:30', '15:00', 'matan', 'lecture', '2304', 'Ржонсицкая Юлия Борисовна'],
  [5, 2, '15:30', '17:00', 'matan', 'lecture', '2304', 'Ржонсицкая Юлия Борисовна'],
  [5, 1, '15:30', '17:00', 'isrpo', 'lecture', '2342', 'Койнов Руслан Васильевич'],
  [5, 'every', '17:10', '18:40', 'matan', 'practice', '2138', 'Бровкина Екатерина Анатольевна'],
  [6, 'every', '09:50', '11:20', 'op', 'lecture', 'Lemon Classroom (1419)', 'Хвастунов Александр Павлович'],
  [6, 'every', '11:30', '13:00', 'aisd', 'lecture', '2342', 'Ткаченко Данил Михайлович'],
  [6, 'every', '15:30', '17:00', 'op', 'lab', '2311', 'Влад Сергей Евгеньевич'],
  [6, 'every', '17:10', '18:40', 'dm', 'practice', '2407 (архив)', 'Кулешова Екатерина Дмитриевна'],
];

export const M3102_CLASSES: ClassSession[] = ROWS.map(([weekday, weeks, startTime, endTime, subjectId, type, room, teacher], index) => ({
  id: `m3102-class-${index + 1}`,
  createdAt: SEED_TIME,
  updatedAt: SEED_TIME,
  weekday,
  weeks,
  startTime,
  endTime,
  subjectId,
  type,
  room,
  teacher,
  building: KRONVERKSKY,
}));

export const M3102_SEMESTER = {
  semesterStart: '2026-09-01',
  /** Понедельник нечётной недели — на сайте группы 21.09.2026 чётная, значит 14.09 нечётная */
  weekOneStart: '2026-09-14',
};

export interface Student {
  name: string;
  github: string;
  telegram?: string;
  /** Короткий факт о себе — как на сайте группы */
  fact: string;
  role?: string;
}

/** Студенты группы — список с сайта M3102 */
export const M3102_STUDENTS: Student[] = [
  { name: 'Громов Алексей Алексеевич', github: 'AlexGromov63', fact: 'Христианин', telegram: 'xalex63gr' },
  { name: 'Гулякин Илья Александрович', github: 'OMNIlos', fact: 'Баскетбол', telegram: 'I1yaGul' },
  { name: 'Гурьянов Тимофей Анатольевич', github: 'yukinohidesu', fact: 'Линукс', telegram: 'magicalseal' },
  { name: 'Давалов Артём Алексеевич', github: 'artemiks727', fact: 'Егермейстер', telegram: 'braindead96' },
  { name: 'Дедков Артём Витальевич', github: 'Xnow1-jpg', fact: 'Строитель', telegram: 'Xnow12' },
  { name: 'Демидов Максим Алексеевич', github: 'MaxDemidov08', fact: 'Спортпрога', telegram: 'Ya_chme_n' },
  { name: 'Демченко Алексей Владимирович', github: 'AIAlDem', fact: '42', telegram: 'Valbamyor' },
  { name: 'Долинский Сергей Александрович', github: 'CHuD00', fact: 'Гитара', telegram: 'Prst_CHuD0' },
  { name: 'Дрей Даниил Александрович', github: 'h1xman', fact: 'Кокакола', telegram: 'talantlshe' },
  { name: 'Дусаев Радик Рустемович', github: 'Noname132089', fact: 'Радик', telegram: 'Raadiusik' },
  { name: 'Еланский Максим Дмитриевич', github: 'Max112008', fact: 'Футбол', telegram: 'maxelanskiy' },
  { name: 'Жаворонкин Марк Леонидович', github: 'LazerProOk1', fact: 'Гитара', telegram: 'ntmarki' },
  { name: 'Жупиков Федор Максимович', github: 'RedstoneLord', fact: 'Рокер', telegram: 'zhupikoff', role: 'Староста' },
  { name: 'Зюриков Андрей Артурович', github: 'zur1kov', fact: 'Старс', telegram: 'zurikov' },
  { name: 'Ильюшин Тимофей Леонидович', github: 'Ficror', fact: 'Спорт', telegram: 'ficror' },
  { name: 'Имануилов Кирилл Дмитриевич', github: 'ima-kir-study', fact: 'Разработка', telegram: 'bird_6138' },
  { name: 'Калугин Александр Михайлович', github: 'sniper2450', fact: 'Фигурист', telegram: 'Sniper2_45' },
  { name: 'Кальнин Давид Артемович', github: 'davidossss', fact: 'Карьерист', telegram: 'happydolcevita' },
  { name: 'Капланян Арман Ованесович', github: 'KaplanianArman', fact: 'Суворовец', telegram: 'Arman_Kaplanyan' },
  { name: 'Кириченко Артём Иванович', github: 'Art21kir', fact: '2.3', telegram: 'Art21kir' },
  { name: 'Новожилова Марьяна Сергеевна', github: 'maryasch', fact: 'Чтение', telegram: 'cgsg67' },
  { name: 'Попова Екатерина Владимировна', github: 'EkaterinaPopova6', fact: 'Вязание', telegram: 'epv08' },
];
