import { ConfirmDeleteModal } from '../../components/ui/ConfirmDeleteModal';
import { getStudyWeek } from '../../lib/studyWeek';
import { useClock } from '../../lib/useClock';
import { ClassDialog } from '../schedule/ClassDialog';
import { ExceptionDialog } from '../schedule/ExceptionDialog';
import { getOccurrencesForDate } from '../schedule/occurrences';
import { useScheduleData } from '../schedule/scheduleStore';
import { useScheduleDialogs } from '../schedule/useScheduleDialogs';
import { getClassStatus } from './classStatus';
import { DeadlinesPanel, HomeworkPanel, MaterialsPanel, RecentNotesPanel, StudyPlanPanel } from './HomePanels';
import { NextClassBlock } from './NextClassBlock';
import { TodayHeader } from './TodayHeader';
import { TodaySchedule } from './TodaySchedule';
import styles from './TodayPage.module.css';

/** Главная группы М3102: учебный день, дедлайны, ДЗ, материалы, личный план, недавние конспекты. */
export function TodayPage() {
  const { today, time } = useClock();
  const scheduleData = useScheduleData();
  const scheduleDialogs = useScheduleDialogs();

  const week = getStudyWeek(today, scheduleData.semesterStart, scheduleData.weekOneStart);
  const todayOccurrences = getOccurrencesForDate(today, scheduleData);
  const classStatus = getClassStatus(scheduleData, today, time);

  return (
    <>
      <TodayHeader date={today} week={week} />
      <NextClassBlock status={classStatus} />

      <div className={styles.grid}>
        <TodaySchedule occurrences={todayOccurrences} today={today} time={time} onAction={scheduleDialogs.handleAction} />
        <DeadlinesPanel />
        <HomeworkPanel today={today} />
        <MaterialsPanel />
        <StudyPlanPanel today={today} />
        <RecentNotesPanel />
      </div>

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
