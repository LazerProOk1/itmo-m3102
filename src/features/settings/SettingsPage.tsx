import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { AppearanceSettings } from './AppearanceSettings';
import { DataSettings } from './DataSettings';
import { EDITING_ENABLED } from './EditModeContext';
import { GeneralSettings } from './GeneralSettings';
import styles from './settings.module.css';

type SettingsTab = 'general' | 'appearance' | 'data';

// «Общие» — даты семестра, их меняют только в react-app-dev; на сайте для просмотра вкладка была бы пустой
const TABS: TabItem<SettingsTab>[] = [
  ...(EDITING_ENABLED ? [{ value: 'general' as const, label: 'Общие' }] : []),
  { value: 'appearance', label: 'Оформление' },
  { value: 'data', label: 'Данные' },
];

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>(TABS[0]!.value);

  return (
    <>
      <PageHeader title="Настройки" />
      <div className={styles.page}>
        <Tabs label="Разделы настроек" items={TABS} value={tab} onChange={setTab} />
        <div role="tabpanel">
          {tab === 'general' && <GeneralSettings />}
          {tab === 'appearance' && <AppearanceSettings />}
          {tab === 'data' && <DataSettings />}
        </div>
      </div>
    </>
  );
}
