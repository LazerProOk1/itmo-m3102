import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createEntity, replaceEntity } from '../../lib/entity';
import { storageKey } from '../../lib/storage';
import type { ID, Task, TaskPriority, TaskStatus, TaskType } from '../../types/models';

export interface TaskDraft {
  title: string;
  subjectId?: string;
  type: TaskType;
  deadline?: string;
  priority: TaskPriority;
  status: TaskStatus;
  description?: string;
  links: string[];
}

interface TasksStore {
  tasks: Task[];
  addTask: (draft: TaskDraft) => void;
  updateTask: (id: ID, draft: TaskDraft) => void;
  deleteTask: (id: ID) => void;
  toggleDone: (id: ID) => void;
  setStatus: (id: ID, status: TaskStatus) => void;
}

function patch(tasks: Task[], id: ID, change: (task: Task) => Partial<Task>): Task[] {
  return tasks.map((task) => (task.id === id ? { ...task, ...change(task), updatedAt: new Date().toISOString() } : task));
}

/** Задачи. Дедлайны из репозитория группы попадают сюда же синхронизацией (id "gh:deadline:…"). */
export const useTasksStore = create<TasksStore>()(
  persist(
    (set) => ({
      tasks: [],
      addTask: (draft) => set((state) => ({ tasks: [createEntity(draft), ...state.tasks] })),
      updateTask: (id, draft) =>
        set((state) => ({ tasks: state.tasks.map((task) => (task.id === id ? replaceEntity(task, draft) : task)) })),
      deleteTask: (id) => set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) })),
      toggleDone: (id) =>
        set((state) => ({ tasks: patch(state.tasks, id, (task) => ({ status: task.status === 'done' ? 'todo' : 'done' })) })),
      setStatus: (id, status) => set((state) => ({ tasks: patch(state.tasks, id, () => ({ status })) })),
    }),
    { name: storageKey('tasks') },
  ),
);
