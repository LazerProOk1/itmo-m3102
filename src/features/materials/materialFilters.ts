import type { Material } from '../../types/models';

export type MaterialFilter = 'all' | 'literature' | 'assignments' | 'google';
export type MaterialSort = 'date' | 'name';

export function filterMaterials(materials: Material[], filter: MaterialFilter): Material[] {
  switch (filter) {
    case 'all':
      return materials;
    case 'literature':
      return materials.filter((material) => (material.category ?? 'other') === 'literature');
    case 'assignments':
      return materials.filter((material) => (material.category ?? 'other') === 'assignments');
    case 'google':
      return materials.filter((material) => material.type === 'google_drive' || material.type === 'google_docs');
  }
}

/** Ищет по названию и описанию, без учёта регистра */
export function searchMaterials(materials: Material[], query: string): Material[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return materials;

  return materials.filter((material) => material.name.toLowerCase().includes(normalized) || material.description?.toLowerCase().includes(normalized));
}

export function sortMaterials(materials: Material[], sort: MaterialSort): Material[] {
  return [...materials].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b.createdAt.localeCompare(a.createdAt)));
}
