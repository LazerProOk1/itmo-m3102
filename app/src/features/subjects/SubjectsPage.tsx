import { Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { List } from '../../components/ui/List';
import { PageHeader } from '../../components/ui/PageHeader';
import { pluralize } from '../../lib/pluralize';
import { useEditMode } from '../settings/EditModeContext';
import { SubjectDialog } from './SubjectDialog';
import { SubjectRow } from './SubjectRow';
import { useSubjectDialog } from './useSubjectDialog';
import { useSubjectsStore } from './subjectsStore';

/** Страница предметов. Предметы хранятся в localStorage. */
export function SubjectsPage() {
  const { isEditMode } = useEditMode();
  const subjects = useSubjectsStore((state) => state.subjects);
  const dialog = useSubjectDialog();

  return (
    <>
      <PageHeader
        title="Предметы"
        subtitle={`${pluralize(subjects.length, ['предмет', 'предмета', 'предметов'])} в этом семестре`}
        actions={
          isEditMode && (
            <Button variant="primary" icon={Plus} onClick={dialog.openCreate}>
              Добавить предмет
            </Button>
          )
        }
      />

      <List className="stagger">
        {subjects.map((subject) => (
          <SubjectRow key={subject.id} subject={subject} />
        ))}
      </List>

      <SubjectDialog target={dialog.target} onClose={dialog.close} />
    </>
  );
}
