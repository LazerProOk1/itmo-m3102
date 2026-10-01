import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createEntity, replaceEntity } from '../../lib/entity';
import { storageKey } from '../../lib/storage';
import type { Event, ID } from '../../types/models';

export interface EventDraft {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  description?: string;
}

interface EventsStore {
  events: Event[];
  addEvent: (draft: EventDraft) => void;
  updateEvent: (id: ID, draft: EventDraft) => void;
  deleteEvent: (id: ID) => void;
}

/** Обычные события календаря */
export const useEventsStore = create<EventsStore>()(
  persist(
    (set) => ({
      events: [],
      addEvent: (draft) => set((state) => ({ events: [createEntity(draft), ...state.events] })),
      updateEvent: (id, draft) =>
        set((state) => ({ events: state.events.map((event) => (event.id === id ? replaceEntity(event, draft) : event)) })),
      deleteEvent: (id) => set((state) => ({ events: state.events.filter((event) => event.id !== id) })),
    }),
    { name: storageKey('events') },
  ),
);
