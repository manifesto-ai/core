'use client';

/**
 * TaskFlow Store Provider
 *
 * Provides the Manifesto v2 app runtime to React components.
 * Replaces Zustand with the Manifesto App facade.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import type { Unsubscribe } from '@manifesto-ai/app';
import type { ActorRef, IntentBody } from '@manifesto-ai/world';
import {
  createTaskFlowApp,
  type TaskFlowApp,
  type TaskFlowState,
  type TaskFlowComputed,
  type Task,
  type ViewMode,
  type Filter,
} from '@/manifesto';

// ============================================================================
// Context Types
// ============================================================================

interface TasksContextValue {
  // App instance
  app: TaskFlowApp | null;

  // State
  state: TaskFlowState | null;
  computed: TaskFlowComputed | null;

  // Loading state
  isReady: boolean;

  // Actions
  dispatch: (body: IntentBody, actor?: ActorRef) => Promise<void>;

  // Convenience methods
  createTask: TaskFlowApp['createTask'];
  importTask: TaskFlowApp['importTask'];
  updateTask: TaskFlowApp['updateTask'];
  deleteTask: TaskFlowApp['deleteTask'];
  moveTask: TaskFlowApp['moveTask'];
  selectTask: TaskFlowApp['selectTask'];
  changeView: TaskFlowApp['changeView'];
  restoreTask: TaskFlowApp['restoreTask'];
  refreshFilters: TaskFlowApp['refreshFilters'];
  setFilter: TaskFlowApp['setFilter'];
  clearFilter: TaskFlowApp['clearFilter'];

  // Actor management
  registerAssistant: (sessionId: string) => ActorRef;
  getUserActor: () => ActorRef | null;
}

// Derived context for computed values
interface TasksDerivedContext {
  totalCount: number;
  todoCount: number;
  inProgressCount: number;
  reviewCount: number;
  doneCount: number;
  deletedCount: number;
  filteredTasks: Task[];
  todoTasks: Task[];
  inProgressTasks: Task[];
  reviewTasks: Task[];
  doneTasks: Task[];
  deletedTasks: Task[];
  selectedTask: Task | null;
  hasSelection: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// ============================================================================
// Contexts
// ============================================================================

const TasksContext = createContext<TasksContextValue | null>(null);
const TasksDerivedContext = createContext<TasksDerivedContext | null>(null);

// ============================================================================
// Hooks
// ============================================================================

/**
 * Access the TaskFlow context
 */
export function useTasks(): TasksContextValue {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error('useTasks must be used within TasksProvider');
  }
  return context;
}

/**
 * Access derived/computed values
 */
export function useTasksDerived(): TasksDerivedContext {
  const context = useContext(TasksDerivedContext);
  if (!context) {
    throw new Error('useTasksDerived must be used within TasksProvider');
  }
  return context;
}

/**
 * Access the raw state
 */
export function useTasksState(): TaskFlowState | null {
  const { state } = useTasks();
  return state;
}

/**
 * Access computed values
 */
export function useTasksComputed(): TaskFlowComputed | null {
  const { computed } = useTasks();
  return computed;
}

// ============================================================================
// Provider
// ============================================================================

interface TasksProviderProps {
  children: ReactNode;
}

export function TasksProvider({ children }: TasksProviderProps) {
  const [app, setApp] = useState<TaskFlowApp | null>(null);
  const [state, setState] = useState<TaskFlowState | null>(null);
  const [computed, setComputed] = useState<TaskFlowComputed | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize the app
  useEffect(() => {
    let mounted = true;
    let unsubscribe: Unsubscribe | undefined;

    const initApp = async () => {
      try {
        // Create app with snapshot change handler
        const taskFlowApp = await createTaskFlowApp({
          onSnapshotChange: (snapshot) => {
            console.log('[TasksProvider] onSnapshotChange received');
            console.log('[TasksProvider] Snapshot data:', snapshot.data);
            if (!mounted) {
              console.log('[TasksProvider] Component unmounted, skipping update');
              return;
            }

            // Update state from snapshot
            const data = snapshot.data;
            const computedVals = snapshot.computed as Record<string, unknown>;

            console.log('[TasksProvider] Updating React state with tasks:', (data.tasks as unknown[])?.length ?? 0);
            setState({
              tasks: (data.tasks ?? []) as Task[],
              currentFilter: (data.currentFilter ?? { status: null, priority: null, assignee: null }) as Filter,
              selectedTaskId: (data.selectedTaskId ?? null) as string | null,
              viewMode: (data.viewMode ?? 'kanban') as ViewMode,
              isCreating: (data.isCreating ?? false) as boolean,
              isEditing: (data.isEditing ?? false) as boolean,
              activeTasks: (data.activeTasks ?? null) as Task[] | null,
              todoTasks: (data.todoTasks ?? null) as Task[] | null,
              inProgressTasks: (data.inProgressTasks ?? null) as Task[] | null,
              reviewTasks: (data.reviewTasks ?? null) as Task[] | null,
              doneTasks: (data.doneTasks ?? null) as Task[] | null,
              deletedTasks: (data.deletedTasks ?? null) as Task[] | null,
            });

            // Computed values (prefixed keys from Core)
            setComputed({
              totalCount: (computedVals["computed.totalCount"] ?? 0) as number,
              todoCount: (computedVals["computed.todoCount"] ?? 0) as number,
              inProgressCount: (computedVals["computed.inProgressCount"] ?? 0) as number,
              reviewCount: (computedVals["computed.reviewCount"] ?? 0) as number,
              doneCount: (computedVals["computed.doneCount"] ?? 0) as number,
              deletedCount: (computedVals["computed.deletedCount"] ?? 0) as number,
              hasSelection: (computedVals["computed.hasSelection"] ?? false) as boolean,
              canCreate: (computedVals["computed.canCreate"] ?? true) as boolean,
              canEdit: (computedVals["computed.canEdit"] ?? false) as boolean,
              canDelete: (computedVals["computed.canDelete"] ?? false) as boolean,
            });
          },
        });

        if (!mounted) {
          taskFlowApp.dispose();
          return;
        }

        // Initialize app runtime
        await taskFlowApp.initialize();

        if (!mounted) {
          taskFlowApp.dispose();
          return;
        }

        setApp(taskFlowApp);
        setIsReady(true);
      } catch (error) {
        console.error('[TasksProvider] Failed to initialize:', error);
      }
    };

    initApp();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Compute derived context
  const derivedContext = useMemo<TasksDerivedContext>(() => {
    const tasks = state?.tasks ?? [];
    const selectedTaskId = state?.selectedTaskId;

    return {
      totalCount: computed?.totalCount ?? 0,
      todoCount: computed?.todoCount ?? 0,
      inProgressCount: computed?.inProgressCount ?? 0,
      reviewCount: computed?.reviewCount ?? 0,
      doneCount: computed?.doneCount ?? 0,
      deletedCount: computed?.deletedCount ?? 0,
      filteredTasks: state?.activeTasks ?? [],
      todoTasks: state?.todoTasks ?? [],
      inProgressTasks: state?.inProgressTasks ?? [],
      reviewTasks: state?.reviewTasks ?? [],
      doneTasks: state?.doneTasks ?? [],
      deletedTasks: state?.deletedTasks ?? [],
      selectedTask: selectedTaskId ? tasks.find(t => t.id === selectedTaskId) ?? null : null,
      hasSelection: computed?.hasSelection ?? false,
      canCreate: computed?.canCreate ?? true,
      canEdit: computed?.canEdit ?? false,
      canDelete: computed?.canDelete ?? false,
    };
  }, [state, computed]);

  // Context value
  const contextValue = useMemo<TasksContextValue>(() => {
    // No-op functions for when app is not ready
    const noop = async () => {};
    const noopSync = () => null as any;

    return {
      app,
      state,
      computed,
      isReady,
      dispatch: app?.dispatch ?? noop,
      createTask: app?.createTask ?? noop,
      importTask: app?.importTask ?? noop,
      updateTask: app?.updateTask ?? noop,
      deleteTask: app?.deleteTask ?? noop,
      moveTask: app?.moveTask ?? noop,
      selectTask: app?.selectTask ?? noop,
      changeView: app?.changeView ?? noop,
      restoreTask: app?.restoreTask ?? noop,
      refreshFilters: app?.refreshFilters ?? noop,
      setFilter: app?.setFilter ?? noop,
      clearFilter: app?.clearFilter ?? noop,
      registerAssistant: app?.registerAssistant ?? noopSync,
      getUserActor: () => app?.getUserActor() ?? null,
    };
  }, [app, state, computed, isReady]);

  // Don't render children until ready
  if (!isReady) {
    return null;
  }

  return (
    <TasksContext.Provider value={contextValue}>
      <TasksDerivedContext.Provider value={derivedContext}>
        {children}
      </TasksDerivedContext.Provider>
    </TasksContext.Provider>
  );
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  Task,
  ViewMode,
  Filter,
  TaskFlowState,
  TaskFlowComputed,
  TaskFlowApp,
} from '@/manifesto';
