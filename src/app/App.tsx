import { lazy, useEffect, type ComponentType } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { AppShell } from '../components/layout/AppShell';
import { EditModeProvider } from '../features/settings/EditModeContext';
import { TodayPage } from '../features/today/TodayPage';
import { useSyncStore } from '../services/syncStore';
import { SECTIONS } from './navigation';

/**
 * Страницы грузятся отдельными кусками: при открытии сайта качается только главная (web.dev: code splitting
 * по маршрутам). Остальные докачиваются в простое браузера — переход по меню всё равно мгновенный.
 */
const loaders: (() => Promise<unknown>)[] = [];
/** prefetch: false — страница редкая и тяжёлая (дизайн-система, редактор схем): не качаем заранее, только по переходу */
function page<M>(load: () => Promise<M>, name: keyof M, prefetch = true) {
  // Уже загруженную страницу рисуем напрямую: React.lazy даже с готовым модулем один раз «приостанавливается»
  // при первом показе — и первый переход на каждую страницу мигал скелетом
  let loaded: ComponentType | null = null;
  const get = () => load().then((module) => (loaded = module[name] as ComponentType));
  if (prefetch) loaders.push(get);
  const Lazy = lazy(() => get().then((component) => ({ default: component })));
  return function Page() {
    const Loaded = loaded;
    return Loaded ? <Loaded /> : <Lazy />;
  };
}

const CalendarPage = page(() => import('../features/calendar/CalendarPage'), 'CalendarPage');
const DeadlinesPage = page(() => import('../features/deadlines/DeadlinesPage'), 'DeadlinesPage');
const DesignSystemPage = page(() => import('../features/design/DesignSystemPage'), 'DesignSystemPage', false);
const DiagramEditorPage = page(() => import('../features/diagrams/DiagramEditorPage'), 'DiagramEditorPage', false);
const LinksPage = page(() => import('../features/group/LinksPage'), 'LinksPage');
const MemesPage = page(() => import('../features/group/MemesPage'), 'MemesPage');
const RepoFilePage = page(() => import('../features/group/RepoFilePage'), 'RepoFilePage');
const StudentsPage = page(() => import('../features/group/StudentsPage'), 'StudentsPage');
const HomeworkPage = page(() => import('../features/homework/HomeworkPage'), 'HomeworkPage');
const LectureNoteViewPage = page(() => import('../features/materials/LectureNoteViewPage'), 'LectureNoteViewPage');
const MaterialsPage = page(() => import('../features/materials/MaterialsPage'), 'MaterialsPage');
const MorePage = page(() => import('../features/more/MorePage'), 'MorePage');
const NotesPage = page(() => import('../features/notes/NotesPage'), 'NotesPage');
const SchedulePage = page(() => import('../features/schedule/SchedulePage'), 'SchedulePage');
const SettingsPage = page(() => import('../features/settings/SettingsPage'), 'SettingsPage');
const SubjectDetailPage = page(() => import('../features/subjects/SubjectDetailPage'), 'SubjectDetailPage');
const SubjectsPage = page(() => import('../features/subjects/SubjectsPage'), 'SubjectsPage');
const TasksPage = page(() => import('../features/tasks/TasksPage'), 'TasksPage');
const ReviewPage = page(() => import('../features/quizzes/ReviewPage'), 'ReviewPage');
const ExamPage = page(() => import('../features/quizzes/ExamPage'), 'ExamPage');
// Игра тяжёлая (~60 КБ) — грузится, только когда её открыли
const GamePage = lazy(() => import('../features/game/GamePage'));

/**
 * Все страницы приложения. Данные живут в localStorage (backend нет), конспекты, материалы
 * и дедлайны группы подтягиваются из GitHub при открытии — см. services/githubContent.
 *
 * HashRouter хранит адрес страницы после «#» (например, /#/tasks): у GitHub Pages нет
 * серверной маршрутизации, поэтому только так перезагрузка и прямые ссылки работают без 404.
 */
export function App() {
  useEffect(() => {
    // Нет сети или исчерпан лимит GitHub — остаются данные прошлой синхронизации.
    // Повторный вызов (StrictMode) безопасен: syncStore не запускает вторую синхронизацию поверх идущей
    const sync = () => void useSyncStore.getState().runAuto();
    sync();
    // Страницы докачиваются в простое — или раньше, при первом движении мыши/касании: на загруженном
    // процессоре простоя может не быть секундами, и первый клик ждал загрузку страницы 1–2 с
    const prefetch = () => loaders.forEach((load) => void load());
    const idle = window.requestIdleCallback ?? ((callback: () => void) => setTimeout(callback, 1500));
    idle(prefetch);
    addEventListener('pointerover', prefetch, { once: true });
    addEventListener('touchstart', prefetch, { once: true, passive: true });
    // Вернулась сеть — догоняем
    addEventListener('online', sync);
    return () => removeEventListener('online', sync);
  }, []);

  return (
    <EditModeProvider>
      {/* Без startTransition: переход по ссылке — сразу, а не «отложенно»; иначе flushSync в lib/morph.ts не дорисовывал
          новую страницу до снимка View Transition. Пока ленивая страница грузится, виден PageSkeleton */}
      <HashRouter useTransitions={false}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to={SECTIONS.today.path} replace />} />

            <Route path="today" element={<TodayPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="deadlines" element={<DeadlinesPage />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="subjects/:subjectId" element={<SubjectDetailPage />} />
            <Route path="subjects/:subjectId/exam" element={<ExamPage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="materials" element={<MaterialsPage />} />
            <Route path="materials/notes/*" element={<LectureNoteViewPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="homework" element={<HomeworkPage />} />
            <Route path="files/*" element={<RepoFilePage />} />
            <Route path="links" element={<LinksPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="memes" element={<MemesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="more" element={<MorePage />} />
            <Route path="design" element={<DesignSystemPage />} />
            <Route path="diagrams" element={<DiagramEditorPage />} />
            <Route path="game" element={<GamePage />} />

            {/* Неизвестный адрес — возвращаем на главную */}
            <Route path="*" element={<Navigate to={SECTIONS.today.path} replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </EditModeProvider>
  );
}
