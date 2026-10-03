import { ConfirmDeleteModal } from '../../components/ui/ConfirmDeleteModal';
import { Reveal } from '../../components/ui/Reveal';
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
import { ReviewBanner, SubjectsPanel } from './SubjectsPanel';
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
      <ReviewBanner today={today} />

      <div className={styles.grid}>
        {[
          <TodaySchedule key="schedule" occurrences={todayOccurrences} today={today} time={time} onAction={scheduleDialogs.handleAction} />,
          <DeadlinesPanel key="deadlines" />,
          <HomeworkPanel key="homework" today={today} />,
          <MaterialsPanel key="materials" />,
          <StudyPlanPanel key="plan" today={today} />,
          <RecentNotesPanel key="notes" />,
          <SubjectsPanel key="subjects" today={today} time={time} />,
        ].map((panel, index) => (
          <Reveal key={panel.key} index={index + 1}>
            {panel}
          </Reveal>
        ))}
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
