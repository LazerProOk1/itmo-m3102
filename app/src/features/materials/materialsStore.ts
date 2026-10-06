import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createEntity, replaceEntity } from '../../lib/entity';
import { localStore, storageKey } from '../../lib/storage';
import type { ID, Material, MaterialCategory, MaterialType } from '../../types/models';

export interface MaterialDraft {
  name: string;
  subjectId?: string;
  category?: MaterialCategory;
  type: MaterialType;
  url: string;
  description?: string;
}

interface MaterialsStore {
  materials: Material[];
  addMaterial: (draft: MaterialDraft) => void;
  updateMaterial: (id: ID, draft: MaterialDraft) => void;
  deleteMaterial: (id: ID) => void;
}

/**
 * Материалы (документы и ссылки). Файлы из репозитория группы приходят синхронизацией (id "gh:…").
 * Ссылка «type: link» — это и есть «быстрые ссылки» на странице предмета.
 */
export const useMaterialsStore = create<MaterialsStore>()(
  persist(
    (set) => ({
      materials: [],
      addMaterial: (draft) => set((state) => ({ materials: [createEntity(draft), ...state.materials] })),
      updateMaterial: (id, draft) =>
        set((state) => ({ materials: state.materials.map((material) => (material.id === id ? replaceEntity(material, draft) : material)) })),
      deleteMaterial: (id) => set((state) => ({ materials: state.materials.filter((material) => material.id !== id) })),
    }),
    { name: storageKey('materials'), storage: localStore },
  ),
);
