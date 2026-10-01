import { Input } from '../../components/ui/Input';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/SegmentedControl';
import type { TimeFormat } from '../../types/models';
import { EDITING_ENABLED } from './EditModeContext';
import { useSemesterSettingsStore } from './semesterSettingsStore';
import { SettingsRow } from './SettingsRow';
import styles from './settings.module.css';

const TIME_FORMAT_OPTIONS: SegmentedOption<TimeFormat>[] = [
  { value: '24h', label: '24 часа' },
  { value: '12h', label: '12 часов' },
];

export function GeneralSettings() {
  const semesterStart = useSemesterSettingsStore((state) => state.semesterStart);
  const weekOneStart = useSemesterSettingsStore((state) => state.weekOneStart);
  const timeFormat = useSemesterSettingsStore((state) => state.timeFormat);
  const updateSemesterSettings = useSemesterSettingsStore((state) => state.updateSemesterSettings);

  return (
    <>
      {/* Даты семестра и чётность задаёт синхронизация с расписанием группы — вручную только в react-app-dev */}
      {EDITING_ENABLED && (
        <>
          <SettingsRow label="Начало семестра" description="От этой даты считаются номера недель в расписании." htmlFor="semester-start">
            <Input
              id="semester-start"
              type="date"
              className={styles.dateInput}
              value={semesterStart}
              onChange={(event) => {
                // Пустую дату не сохраняем — поле вернётся к прежнему значению
                if (event.target.value) updateSemesterSettings({ semesterStart: event.target.value });
              }}
            />
          </SettingsRow>

          <SettingsRow
            label="Нечётная неделя"
            description="Любой день нечётной недели — от него считается чётность всех остальных."
            htmlFor="week-one-start"
          >
            <Input
              id="week-one-start"
              type="date"
              className={styles.dateInput}
              value={weekOneStart}
              onChange={(event) => {
                if (event.target.value) updateSemesterSettings({ weekOneStart: event.target.value });
              }}
            />
          </SettingsRow>
        </>
      )}

      <SettingsRow label="Формат времени">
        <SegmentedControl
          label="Формат времени"
          options={TIME_FORMAT_OPTIONS}
          value={timeFormat}
          onChange={(value) => updateSemesterSettings({ timeFormat: value })}
        />
      </SettingsRow>
    </>
  );
}
