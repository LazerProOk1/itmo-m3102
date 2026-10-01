import type { BaseEntity } from '../types/models';

export function createEntity<T extends object>(draft: T): T & BaseEntity {
  const now = new Date().toISOString();
  return { ...draft, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
}

/** Замена полей формы целиком (как PUT): поле, которого нет в draft, очищается. `keep` — поля вне формы. */
export function replaceEntity<E extends BaseEntity, D extends object>(item: E, draft: D, keep?: Partial<E>): E {
  return { id: item.id, createdAt: item.createdAt, ...keep, ...draft, updatedAt: new Date().toISOString() } as unknown as E;
}
