import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  ClipboardList,
  CalendarDays,
  CalendarRange,
  Clock,
  Ellipsis,
  FolderOpen,
  Gamepad2,
  Shapes,
  House,
  Image,
  NotebookPen,
  Palette,
  Repeat2,
  Settings,
  SquareCheck,
  Users,
} from 'lucide-react';

/** Раздел приложения: страница со своим адресом и пунктом в меню. */
export interface Section {
  label: string;
  path: string;
  icon: LucideIcon;
}

/** Единый список разделов. Меню на компьютере и телефоне строятся из него. */
export const SECTIONS = {
  today: { label: 'Главная', path: '/today', icon: House },
  schedule: { label: 'Расписание', path: '/schedule', icon: CalendarDays },
  calendar: { label: 'Календарь', path: '/calendar', icon: CalendarRange },
  tasks: { label: 'Учебный план', path: '/tasks', icon: SquareCheck },
  homework: { label: 'Домашнее задание', path: '/homework', icon: ClipboardList },
  deadlines: { label: 'Дедлайны', path: '/deadlines', icon: Clock },
  subjects: { label: 'Предметы', path: '/subjects', icon: BookOpen },
  review: { label: 'Повторение', path: '/review', icon: Repeat2 },
  materials: { label: 'Материалы', path: '/materials', icon: FolderOpen },
  notes: { label: 'Заметки', path: '/notes', icon: NotebookPen },
  students: { label: 'Студенты', path: '/students', icon: Users },
  memes: { label: 'Мемы', path: '/memes', icon: Image },
  diagrams: { label: 'Диаграммы', path: '/diagrams', icon: Shapes },
  game: { label: 'Ёжик-кувырок', path: '/game', icon: Gamepad2 },
  settings: { label: 'Настройки', path: '/settings', icon: Settings },
  more: { label: 'Ещё', path: '/more', icon: Ellipsis },
  // Служебная страница со всеми компонентами. В меню её нет — открывается из меню пользователя.
  design: { label: 'Дизайн-система', path: '/design', icon: Palette },
} satisfies Record<string, Section>;

/** Боковое меню: основная группа. */
export const SIDEBAR_PRIMARY: Section[] = [
  SECTIONS.today,
  SECTIONS.schedule,
  SECTIONS.calendar,
  SECTIONS.materials,
  SECTIONS.homework,
  SECTIONS.deadlines,
  SECTIONS.tasks,
  SECTIONS.subjects,
  SECTIONS.review,
  SECTIONS.notes,
];

/** Боковое меню: «Другое», после разделителя. */
export const SIDEBAR_SECONDARY: Section[] = [SECTIONS.students, SECTIONS.diagrams, SECTIONS.memes, SECTIONS.game];

/** Нижняя панель на телефоне (плюс кнопка «Ещё»). */
export const MOBILE_TABS: Section[] = [SECTIONS.today, SECTIONS.schedule, SECTIONS.materials];

/** Всё, что не поместилось в нижнюю панель, — на странице «Ещё». */
export const MORE_PAGE_SECTIONS: Section[] = [
  SECTIONS.calendar,
  SECTIONS.homework,
  SECTIONS.deadlines,
  SECTIONS.tasks,
  SECTIONS.subjects,
  SECTIONS.review,
  SECTIONS.notes,
  SECTIONS.students,
  SECTIONS.diagrams,
  SECTIONS.memes,
  SECTIONS.game,
  SECTIONS.settings,
];

const ALL_SECTIONS: Section[] = Object.values(SECTIONS);

/** Раздел, к которому относится адрес страницы: "/tasks" → Задачи */
export function findSection(pathname: string): Section | undefined {
  // Файлы группы и ссылки — части «Материалов» (вкладки), отдельных разделов у них нет
  if (pathname.startsWith('/files') || pathname.startsWith('/links')) return SECTIONS.materials;
  return ALL_SECTIONS.find((section) => pathname.startsWith(section.path));
}
