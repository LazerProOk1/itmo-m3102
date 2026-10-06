import { GraduationCap, Keyboard, Moon, PanelLeft, Repeat2, RefreshCw, Sun, type LucideIcon } from 'lucide-react';
import { SECTIONS } from '../../app/navigation';
import { useSyncStore } from '../../services/syncStore';
import { useShortcutsDialog } from '../help/ShortcutsDialog';
import { useSettingsStore } from '../settings/settingsStore';
import { useSubjectsStore } from '../subjects/subjectsStore';
import { normalize, queryWords } from './searchIndex';

export interface SearchAction {
  id: string;
  title: string;
  /** Чем ещё человек может это назвать */
  keywords: string;
  icon: LucideIcon;
  subjectId?: string;
  /** navigate — переход по сайту; иначе действие выполняется на месте */
  run: (navigate: (path: string) => void) => void;
}

/** Быстрые действия поиска: то, что иначе ищут по меню и настройкам */
function allActions(dark: boolean): SearchAction[] {
  const subjects = useSubjectsStore.getState().subjects.filter((subject) => !subject.archived);
  return [
    {
      id: 'sync',
      title: 'Синхронизировать с GitHub',
      keywords: 'обновить конспекты дз дедлайны',
      icon: RefreshCw,
      run: () => void useSyncStore.getState().run(),
    },
    {
      id: 'review',
      title: 'Повторить ошибки в тестах',
      keywords: 'повторение тест вопросы',
      icon: Repeat2,
      run: (navigate) => navigate(SECTIONS.review.path),
    },
    ...subjects.map((subject): SearchAction => ({
      id: `exam:${subject.id}`,
      title: `Перед контрольной: ${subject.name}`,
      keywords: 'экзамен контрольная тест подготовка',
      icon: GraduationCap,
      subjectId: subject.id,
      run: (navigate) => navigate(`${SECTIONS.subjects.path}/${subject.id}/exam`),
    })),
    {
      id: 'theme',
      title: dark ? 'Светлая тема' : 'Тёмная тема',
      keywords: 'тема оформление ночь день',
      icon: dark ? Sun : Moon,
      run: () => useSettingsStore.getState().setTheme(dark ? 'light' : 'dark'),
    },
    {
      id: 'sidebar',
      title: 'Свернуть или развернуть меню',
      keywords: 'боковая панель ctrl b',
      icon: PanelLeft,
      run: () => useSettingsStore.getState().toggleSidebar(),
    },
    {
      id: 'offline',
      title: 'Скачать для работы без интернета',
      keywords: 'офлайн оффлайн настройки pdf',
      icon: SECTIONS.settings.icon,
      run: (navigate) => navigate(`${SECTIONS.settings.path}?tab=data`),
    },
    {
      id: 'shortcuts',
      title: 'Горячие клавиши',
      keywords: 'клавиатура сочетания',
      icon: Keyboard,
      run: () => useShortcutsDialog.getState().setOpen(true),
    },
  ];
}

/** Действия под запрос — по началу слов («тема» не находит «математику»); пустой запрос — все */
export function searchActions(query: string, dark: boolean, subjectId?: string): SearchAction[] {
  const words = queryWords(query);
  return allActions(dark).filter((action) => {
    const names = normalize(`${action.title} ${action.keywords}`).split(/[\s:,]+/);
    return (!subjectId || action.subjectId === subjectId) && words.every((word) => names.some((name) => name.startsWith(word)));
  });
}
