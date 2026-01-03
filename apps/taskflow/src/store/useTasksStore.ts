/**
 * Tasks Store Compatibility Layer
 *
 * Provides backward compatibility with the old Zustand store API.
 * Domain state (tasks, viewMode, selectedTaskId) is managed by Manifesto.
 * UI-only state (dateFilter, chatHistory, assistantOpen) is managed locally.
 *
 * This is a transitional file - components should migrate to use:
 * - useTasks() for actions
 * - useTasksDerived() for computed values
 * - useTasksState() for raw state
 */

import { create } from 'zustand';
import type { Task, ViewMode, Filter } from '@/manifesto';
import type { DateFilter } from '@/components/ui/date-range-picker';
import type { ChatMessage } from '@/lib/storage/types';

// Re-export everything from provider for new code
export {
  TasksProvider,
  useTasks,
  useTasksDerived,
  useTasksState,
  useTasksComputed,
  type Task,
  type ViewMode,
  type Filter,
  type TaskFlowState,
  type TaskFlowComputed,
  type TaskFlowApp,
} from './provider';

// ============================================================================
// Legacy UI State Store (for backward compatibility)
// ============================================================================

/**
 * UI-only state that doesn't need to go through Manifesto
 */
interface UIState {
  // UI state
  assistantOpen: boolean;
  dateFilter: DateFilter | null;
  lastCreatedTaskIds: string[];
  lastModifiedTaskId: string | null;
  chatHistory: ChatMessage[];

  // UI actions
  setAssistantOpen: (open: boolean) => void;
  setDateFilter: (filter: DateFilter | null) => void;
  setLastCreatedTaskIds: (ids: string[]) => void;
  setLastModifiedTaskId: (id: string | null) => void;
  setChatHistory: (messages: ChatMessage[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
}

const MAX_CHAT_MESSAGES = 50;

/**
 * UI-only state store
 */
const useUIStore = create<UIState>((set) => ({
  assistantOpen: true,
  dateFilter: null,
  lastCreatedTaskIds: [],
  lastModifiedTaskId: null,
  chatHistory: [],

  setAssistantOpen: (assistantOpen) => set({ assistantOpen }),
  setDateFilter: (dateFilter) => set({ dateFilter }),
  setLastCreatedTaskIds: (lastCreatedTaskIds) => set({ lastCreatedTaskIds }),
  setLastModifiedTaskId: (lastModifiedTaskId) => set({ lastModifiedTaskId }),
  setChatHistory: (chatHistory) => set({ chatHistory }),
  addChatMessage: (message) => set((state) => {
    const updated = [...state.chatHistory, message];
    return { chatHistory: updated.slice(-MAX_CHAT_MESSAGES) };
  }),
  clearChatHistory: () => set({ chatHistory: [] }),
}));

// ============================================================================
// Legacy Store Compatibility (useTasksStore)
// ============================================================================

/**
 * Legacy store interface for backward compatibility
 * @deprecated Use useTasks(), useTasksDerived(), or useTasksState() instead
 */
export interface LegacyTasksStore extends UIState {
  // These are read from context, not stored here
  tasks: Task[];
  currentFilter: Filter;
  selectedTaskId: string | null;
  viewMode: ViewMode;
  isCreating: boolean;
  isEditing: boolean;

  // Legacy setters (these are no-ops - use useTasks() actions instead)
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  softDeleteTask: (id: string) => void;
  restoreTask: (id: string) => void;
  permanentlyDeleteTask: (id: string) => void;
  emptyTrash: () => void;
  setFilter: (filter: Filter) => void;
  setSelectedTaskId: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setIsCreating: (creating: boolean) => void;
  setIsEditing: (editing: boolean) => void;
}

// Warning logged once
let warningLogged = false;

function logDeprecationWarning() {
  if (!warningLogged) {
    console.warn(
      '[TaskFlow] useTasksStore is deprecated. Use useTasks(), useTasksDerived(), or useTasksState() instead.'
    );
    warningLogged = true;
  }
}

/**
 * Legacy store hook for backward compatibility
 *
 * @deprecated Use useTasks(), useTasksDerived(), or useTasksState() instead
 *
 * This provides a Zustand-like API but:
 * - Domain state (tasks, selectedTaskId, viewMode) comes from Manifesto
 * - UI state (dateFilter, chatHistory) comes from local store
 * - Setter functions for domain state are no-ops (use useTasks() actions)
 */
export function useTasksStore<T>(selector: (state: LegacyTasksStore) => T): T {
  logDeprecationWarning();

  // Get UI state from local store
  const uiState = useUIStore();

  // Create a mock state object
  // Domain state will be default values - components should use useTasksDerived() instead
  const mockState: LegacyTasksStore = {
    // Domain state (use defaults - should use new hooks)
    tasks: [],
    currentFilter: { status: null, priority: null, assignee: null },
    selectedTaskId: null,
    viewMode: 'kanban',
    isCreating: false,
    isEditing: false,

    // UI state from local store
    ...uiState,

    // No-op setters for domain state
    setTasks: () => console.warn('useTasksStore.setTasks is deprecated'),
    addTask: () => console.warn('useTasksStore.addTask is deprecated'),
    updateTask: () => console.warn('useTasksStore.updateTask is deprecated'),
    removeTask: () => console.warn('useTasksStore.removeTask is deprecated'),
    softDeleteTask: () => console.warn('useTasksStore.softDeleteTask is deprecated'),
    restoreTask: () => console.warn('useTasksStore.restoreTask is deprecated'),
    permanentlyDeleteTask: () => console.warn('useTasksStore.permanentlyDeleteTask is deprecated'),
    emptyTrash: () => console.warn('useTasksStore.emptyTrash is deprecated'),
    setFilter: () => console.warn('useTasksStore.setFilter is deprecated'),
    setSelectedTaskId: () => console.warn('useTasksStore.setSelectedTaskId is deprecated'),
    setViewMode: () => console.warn('useTasksStore.setViewMode is deprecated'),
    setIsCreating: () => console.warn('useTasksStore.setIsCreating is deprecated'),
    setIsEditing: () => console.warn('useTasksStore.setIsEditing is deprecated'),
  };

  return selector(mockState);
}

// Add getState for legacy compatibility (returns mock state)
useTasksStore.getState = (): LegacyTasksStore => {
  const uiState = useUIStore.getState();
  return {
    tasks: [],
    currentFilter: { status: null, priority: null, assignee: null },
    selectedTaskId: null,
    viewMode: 'kanban',
    isCreating: false,
    isEditing: false,
    ...uiState,
    setTasks: () => {},
    addTask: () => {},
    updateTask: () => {},
    removeTask: () => {},
    softDeleteTask: () => {},
    restoreTask: () => {},
    permanentlyDeleteTask: () => {},
    emptyTrash: () => {},
    setFilter: () => {},
    setSelectedTaskId: () => {},
    setViewMode: () => {},
    setIsCreating: () => {},
    setIsEditing: () => {},
  };
};

// Also export the UI store for direct access
export { useUIStore };
