import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { AppShell } from '../components/layout/AppShell';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { DeadlinesPage } from '../features/deadlines/DeadlinesPage';
import { DesignSystemPage } from '../features/design/DesignSystemPage';
import { DiagramEditorPage } from '../features/diagrams/DiagramEditorPage';
import { LinksPage } from '../features/group/LinksPage';
import { MemesPage } from '../features/group/MemesPage';
import { RepoFilePage } from '../features/group/RepoFilePage';
import { StudentsPage } from '../features/group/StudentsPage';
import { HomeworkPage } from '../features/homework/HomeworkPage';
import { EditModeProvider } from '../features/settings/EditModeContext';
import { LectureNoteViewPage } from '../features/materials/LectureNoteViewPage';
import { MaterialsPage } from '../features/materials/MaterialsPage';
import { MorePage } from '../features/more/MorePage';
import { NotesPage } from '../features/notes/NotesPage';
import { SchedulePage } from '../features/schedule/SchedulePage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { SubjectDetailPage } from '../features/subjects/SubjectDetailPage';
import { SubjectsPage } from '../features/subjects/SubjectsPage';
import { TasksPage } from '../features/tasks/TasksPage';
import { TodayPage } from '../features/today/TodayPage';
import { useSyncStore } from '../services/syncStore';
import { SECTIONS } from './navigation';

// Игра тяжёлая (~60 КБ) — грузится, только когда её открыли
const GamePage = lazy(() => import('../features/game/GamePage'));

let autoSyncStarted = false;

/**
 * Все страницы приложения. Данные живут в localStorage (backend нет), конспекты, материалы
 * и дедлайны группы подтягиваются из GitHub при открытии — см. services/githubContent.
 *
 * HashRouter хранит адрес страницы после «#» (например, /#/tasks): у GitHub Pages нет
 * серверной маршрутизации, поэтому только так перезагрузка и прямые ссылки работают без 404.
 */
export function App() {
  useEffect(() => {
    if (autoSyncStarted) return;
    autoSyncStarted = true;
    // Нет сети или исчерпан лимит GitHub — остаются данные прошлой синхронизации
    void useSyncStore.getState().runAuto();
  }, []);

  return (
    <EditModeProvider>
      <HashRouter>
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
            <Route
              path="game"
              element={
                <Suspense fallback={null}>
                  <GamePage />
                </Suspense>
              }
            />

            {/* Неизвестный адрес — возвращаем на главную */}
            <Route path="*" element={<Navigate to={SECTIONS.today.path} replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </EditModeProvider>
  );
}
