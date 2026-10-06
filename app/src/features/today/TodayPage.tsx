import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDeleteModal } from '../../components/ui/ConfirmDeleteModal';
import { cn } from '../../lib/cn';
import { useSettingsStore } from '../settings/settingsStore';
import { HomeCustomizeDialog } from './HomeCustomizeDialog';
import { arrangeBlocks, HOME_BLOCKS } from './homeLayout';
import { Reveal } from '../../components/ui/Reveal';
import { getStudyWeek } from '../../lib/studyWeek';
import { useClock } from '../../lib/useClock';
import { ClassDialog } from '../schedule/ClassDialog';
import { ExceptionDialog } from '../schedule/ExceptionDialog';
import { getOccurrencesForDate } from '../schedule/occurrences';
import { useScheduleData } from '../schedule/scheduleStore';
import { useScheduleDialogs } from '../schedule/useScheduleDialogs';
import { getClassStatus } from './classStatus';
import { BookmarksPanel, ContinuePanel, DeadlinesPanel, HomeworkPanel, MaterialsPanel, RecentNotesPanel, StudyPlanPanel } from './HomePanels';
import { NextClassBlock } from './NextClassBlock';
import { ReviewBanner, SubjectsPanel } from './SubjectsPanel';
import { TodayHeader } from './TodayHeader';
import { TodaySchedule } from './TodaySchedule';
import styles from './TodayPage.module.css';

/**
 * Главная группы М3102: учебный день, дедлайны, ДЗ, материалы, личный план, недавние конспекты. Порядок и видимость
 * блоков настраиваются («Настроить главную», homeLayout.ts) и хранятся в этом браузере.
 */
export function TodayPage() {
  const homeOrder = useSettingsStore((state) => state.homeOrder);
  const homeHidden = useSettingsStore((state) => state.homeHidden);
  const [customizing, setCustomizing] = useState(false);
  const { today, time } = useClock();
  const scheduleData = useScheduleData();
  const scheduleDialogs = useScheduleDialogs();

  const week = getStudyWeek(today, scheduleData.semesterStart, scheduleData.weekOneStart);
  const todayOccurrences = getOccurrencesForDate(today, scheduleData);
  const classStatus = getClassStatus(scheduleData, today, time);

  return (
    <>
      <TodayHeader date={today} week={week} />

      <div className={styles.grid}>
        {arrangeBlocks(homeOrder)
          .filter((id) => !homeHidden.includes(id))
          .map((id, index) => (
            <Reveal key={id} index={index + 1} className={cn(HOME_BLOCKS.find((block) => block.id === id)!.wide && styles.wide)}>
              {id === 'next' && <NextClassBlock status={classStatus} />}
              {id === 'continue' && <ContinuePanel />}
              {id === 'review' && <ReviewBanner today={today} />}
              {id === 'schedule' && (
                <TodaySchedule occurrences={todayOccurrences} today={today} time={time} onAction={scheduleDialogs.handleAction} />
              )}
              {id === 'deadlines' && <DeadlinesPanel />}
              {id === 'homework' && <HomeworkPanel today={today} />}
              {id === 'materials' && <MaterialsPanel />}
              {id === 'plan' && <StudyPlanPanel today={today} />}
              {id === 'notes' && <RecentNotesPanel />}
              {id === 'subjects' && <SubjectsPanel today={today} time={time} />}
              {id === 'bookmarks' && <BookmarksPanel />}
            </Reveal>
          ))}
      </div>

      <div className={styles.customize}>
        <Button variant="ghost" icon={SlidersHorizontal} onClick={() => setCustomizing(true)}>
          Настроить главную
        </Button>
      </div>
      <HomeCustomizeDialog open={customizing} onClose={() => setCustomizing(false)} />

      <ClassDialog target={scheduleDialogs.classTarget} onClose={scheduleDialogs.closeClassDialog} />
      <ExceptionDialog target={scheduleDialogs.exceptionTarget} onClose={scheduleDialogs.closeExceptionDialog} />
      <ConfirmDeleteModal
        open={scheduleDialogs.isDeleteConfirmOpen}
        title={scheduleDialogs.deleteConfirmTitle}
        onCancel={scheduleDialogs.cancelDelete}
        onConfirm={scheduleDialogs.confirmDelete}
      />
    </>
  );
}
