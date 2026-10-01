import { PageHeader } from '../../components/ui/PageHeader';
import { ControlsDemo } from './ControlsDemo';
import { FeedbackDemo } from './FeedbackDemo';
import { FoundationsDemo } from './FoundationsDemo';
import { OverlaysDemo } from './OverlaysDemo';
import styles from './DesignSystemPage.module.css';

/** Служебная страница: все токены и базовые компоненты в одном месте. */
export function DesignSystemPage() {
  return (
    <>
      <PageHeader title="Дизайн-система" subtitle="Токены и компоненты, используемые во всём приложении." />
      <div className={styles.sections}>
        <FoundationsDemo />
        <ControlsDemo />
        <FeedbackDemo />
        <OverlaysDemo />
      </div>
    </>
  );
}
