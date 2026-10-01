import { PageHeader } from '../../components/ui/PageHeader';
import { BrandDemo } from './BrandDemo';
import { ContentDemo } from './ContentDemo';
import { ControlsDemo } from './ControlsDemo';
import { FeedbackDemo } from './FeedbackDemo';
import { FoundationsDemo } from './FoundationsDemo';
import { MotionDemo } from './MotionDemo';
import { OverlaysDemo } from './OverlaysDemo';
import { SiteDemo } from './SiteDemo';
import styles from './DesignSystemPage.module.css';

/** Служебная страница: бренд, токены, движение, компоненты и контент конспектов в одном месте. */
export function DesignSystemPage() {
  return (
    <>
      <PageHeader title="Дизайн-система М3102" subtitle="Бренд, токены, движение и компоненты сайта группы — всё, из чего он собран." />
      <div className={styles.sections}>
        <BrandDemo />
        <FoundationsDemo />
        <MotionDemo />
        <ControlsDemo />
        <FeedbackDemo />
        <OverlaysDemo />
        <SiteDemo />
        <ContentDemo />
      </div>
    </>
  );
}
