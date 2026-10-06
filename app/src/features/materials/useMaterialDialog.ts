import { useState } from 'react';
import type { ID, Material, MaterialType } from '../../types/models';
import type { MaterialDialogTarget } from './MaterialDialog';

interface CreateDefaults {
  subjectId?: ID;
  type?: MaterialType;
}

/** Какое окно материала открыто: создание нового или редактирование существующего. */
export function useMaterialDialog() {
  const [target, setTarget] = useState<MaterialDialogTarget | null>(null);

  return {
    target,
    openCreate: (defaults?: CreateDefaults) => setTarget({ mode: 'create', defaultSubjectId: defaults?.subjectId, defaultType: defaults?.type }),
    openEdit: (material: Material) => setTarget({ mode: 'edit', material }),
    close: () => setTarget(null),
  };
}
