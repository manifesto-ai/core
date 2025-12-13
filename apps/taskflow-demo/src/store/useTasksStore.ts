/**
 * Tasks Zustand Store
 *
 * Based on @manifesto-ai/bridge-zustand README.md documentation.
 */

import { create } from 'zustand';
import { createRuntime } from '@manifesto-ai/core';
import {
  createZustandAdapter,
  createZustandActuator,
  createBridge,
} from '@manifesto-ai/bridge-zustand';
import { tasksDomain, type Task, type TaskFilter } from '../domain/tasks';
import type { DateFilter } from '@/components/ui/date-range-picker';

// View mode type (including trash)
export type ViewMode = 'todo' | 'kanban' | 'table' | 'trash';

// Zustand store interface
interface TasksStore {
  // Data
  tasks: Task[];
  currentFilter: TaskFilter;

  // State
  selectedTaskId: string | null;
  viewMode: ViewMode;
  isCreating: boolean;
  isEditing: boolean;
  assistantOpen: boolean;
  dateFilter: DateFilter | null;

  // Actions (Zustand-level mutations)
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;  // Legacy: now calls softDeleteTask
  softDeleteTask: (id: string) => void;  // Set deletedAt
  restoreTask: (id: string) => void;  // Clear deletedAt
  permanentlyDeleteTask: (id: string) => void;  // Actually remove from array
  emptyTrash: () => void;  // Remove all deleted tasks
  setFilter: (filter: TaskFilter) => void;
  setSelectedTaskId: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setIsCreating: (creating: boolean) => void;
  setIsEditing: (editing: boolean) => void;
  setAssistantOpen: (open: boolean) => void;
  setDateFilter: (filter: DateFilter | null) => void;
}

// Create Zustand store
export const useTasksStore = create<TasksStore>((set) => ({
  // Initial data
  tasks: [],
  currentFilter: {},

  // Initial state
  selectedTaskId: null,
  viewMode: 'kanban',
  isCreating: false,
  isEditing: false,
  assistantOpen: true,
  dateFilter: null,

  // Actions
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  // Soft delete: set deletedAt timestamp
  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, deletedAt: new Date().toISOString() } : t
      ),
    })),
  softDeleteTask: (id) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, deletedAt: new Date().toISOString() } : t
      ),
    })),
  // Restore: clear deletedAt
  restoreTask: (id) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, deletedAt: undefined } : t
      ),
    })),
  // Permanently delete: actually remove from array
  permanentlyDeleteTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    })),
  // Empty trash: remove all deleted tasks
  emptyTrash: () =>
    set((state) => ({
      tasks: state.tasks.filter((t) => !t.deletedAt),
    })),
  setFilter: (currentFilter) => set({ currentFilter }),
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
  setViewMode: (viewMode) => set({ viewMode }),
  setIsCreating: (isCreating) => set({ isCreating }),
  setIsEditing: (isEditing) => set({ isEditing }),
  setAssistantOpen: (assistantOpen) => set({ assistantOpen }),
  setDateFilter: (dateFilter) => set({ dateFilter }),
}));

// Create Manifesto runtime
// NOTE: README shows createRuntime(domain) but actual API requires { domain } wrapper
export const tasksRuntime = createRuntime({ domain: tasksDomain });

// Create adapter (reads from Zustand → Manifesto)
export const tasksAdapter = createZustandAdapter(useTasksStore, {
  dataSelector: (state) => ({
    tasks: state.tasks,
    currentFilter: state.currentFilter,
  }),
  stateSelector: (state) => ({
    selectedTaskId: state.selectedTaskId,
    viewMode: state.viewMode,
    isCreating: state.isCreating,
    isEditing: state.isEditing,
    dateFilter: state.dateFilter,
  }),
});

// Create actuator (writes from Manifesto → Zustand)
export const tasksActuator = createZustandActuator(useTasksStore, {
  setData: (path, value, store) => {
    if (path === 'data.tasks') {
      store.setState({ tasks: value as Task[] });
    } else if (path === 'data.currentFilter') {
      store.setState({ currentFilter: value as TaskFilter });
    }
  },
  setState: (path, value, store) => {
    if (path === 'state.selectedTaskId') {
      store.setState({ selectedTaskId: value as string | null });
    } else if (path === 'state.viewMode') {
      store.setState({ viewMode: value as ViewMode });
    } else if (path === 'state.isCreating') {
      store.setState({ isCreating: value as boolean });
    } else if (path === 'state.isEditing') {
      store.setState({ isEditing: value as boolean });
    } else if (path === 'state.dateFilter') {
      store.setState({ dateFilter: value as DateFilter | null });
    }
  },
});

// Create bridge
export const tasksBridge = createBridge({
  runtime: tasksRuntime,
  adapter: tasksAdapter,
  actuator: tasksActuator,
});

// Helper hook to get derived values from runtime
export function useTasksDerived<T>(path: string): T {
  // This is a simplified version - in real use, would use useSyncExternalStore
  return tasksRuntime.get(path) as T;
}
