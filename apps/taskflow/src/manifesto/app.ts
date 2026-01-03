/**
 * TaskFlow App Setup
 *
 * Creates and configures the complete Manifesto stack for TaskFlow.
 * This is the main entry point for initializing the TaskFlow application.
 */

import {
  createBridge,
  type Bridge,
  type SnapshotView,
  type Unsubscribe,
} from "@manifesto-ai/bridge";
import type { ActorRef, IntentBody } from "@manifesto-ai/world";

import { createTaskFlowWorld, type TaskFlowWorld, type TaskFlowWorldConfig } from "./world";
import type { Task, ViewMode, Filter } from "../domain/index";

/**
 * TaskFlow App configuration
 */
export interface TaskFlowAppConfig extends TaskFlowWorldConfig {
  /**
   * Callback for snapshot changes
   */
  onSnapshotChange?: (snapshot: SnapshotView) => void;
}

/**
 * TaskFlow state from snapshot
 */
export interface TaskFlowState {
  tasks: Task[];
  currentFilter: Filter;
  selectedTaskId: string | null;
  viewMode: ViewMode;
  isCreating: boolean;
  isEditing: boolean;
  activeTasks: Task[] | null;
  todoTasks: Task[] | null;
  inProgressTasks: Task[] | null;
  reviewTasks: Task[] | null;
  doneTasks: Task[] | null;
  deletedTasks: Task[] | null;
}

/**
 * TaskFlow computed values
 */
export interface TaskFlowComputed {
  totalCount: number;
  todoCount: number;
  inProgressCount: number;
  reviewCount: number;
  doneCount: number;
  deletedCount: number;
  hasSelection: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

/**
 * TaskFlow App instance
 */
export interface TaskFlowApp {
  /**
   * The TaskFlow World
   */
  taskFlowWorld: TaskFlowWorld;

  /**
   * The Bridge for React integration
   */
  bridge: Bridge;

  /**
   * Initialize the app (create genesis, refresh bridge)
   */
  initialize: () => Promise<void>;

  /**
   * Subscribe to snapshot changes
   */
  subscribe: (callback: (snapshot: SnapshotView) => void) => Unsubscribe;

  /**
   * Get the current snapshot
   */
  getSnapshot: () => SnapshotView | null;

  /**
   * Get current state from snapshot
   */
  getState: () => TaskFlowState | null;

  /**
   * Get computed values from snapshot
   */
  getComputed: () => TaskFlowComputed | null;

  /**
   * Dispatch an intent
   */
  dispatch: (body: IntentBody, actor?: ActorRef) => Promise<void>;

  /**
   * Register an AI assistant actor
   */
  registerAssistant: (sessionId: string) => ActorRef;

  /**
   * Get the current user actor
   */
  getUserActor: () => ActorRef;

  /**
   * Dispose of the app (cleanup)
   */
  dispose: () => void;

  // === Convenience Action Methods ===

  /**
   * Create a new task
   */
  createTask: (params: {
    title: string;
    description?: string | null;
    priority?: "low" | "medium" | "high";
    dueDate?: string | null;
    tags?: string[];
  }) => Promise<void>;

  /**
   * Update an existing task
   */
  updateTask: (params: {
    id: string;
    title?: string | null;
    description?: string | null;
    priority?: "low" | "medium" | "high" | null;
    dueDate?: string | null;
  }) => Promise<void>;

  /**
   * Delete a task (soft delete)
   */
  deleteTask: (id: string) => Promise<void>;

  /**
   * Move a task to a new status
   */
  moveTask: (id: string, status: "todo" | "in-progress" | "review" | "done") => Promise<void>;

  /**
   * Select a task
   */
  selectTask: (taskId: string | null) => Promise<void>;

  /**
   * Change the view mode
   */
  changeView: (viewMode: ViewMode) => Promise<void>;

  /**
   * Restore a deleted task
   */
  restoreTask: (id: string) => Promise<void>;

  /**
   * Refresh all filter derived arrays
   */
  refreshFilters: () => Promise<void>;

  /**
   * Set filter
   */
  setFilter: (
    status: "all" | "todo" | "in-progress" | "review" | "done" | null,
    priority: "all" | "low" | "medium" | "high" | null
  ) => Promise<void>;

  /**
   * Clear filter
   */
  clearFilter: () => Promise<void>;
}

/**
 * Create the TaskFlow App
 */
export async function createTaskFlowApp(
  config: TaskFlowAppConfig = {}
): Promise<TaskFlowApp> {
  // Create TaskFlow World
  const taskFlowWorld = await createTaskFlowWorld(config);

  // Create Bridge
  const bridge = createBridge({
    world: taskFlowWorld.world,
    schemaHash: taskFlowWorld.world.schemaHash,
    defaultActor: taskFlowWorld.userActor,
    defaultProjectionId: "bridge:taskflow",
  });

  // Track current snapshot
  let currentSnapshot: SnapshotView | null = null;
  let disposed = false;

  // Subscribe to bridge for snapshot updates
  const unsubscribeBridge = bridge.subscribe((snapshot) => {
    console.log('[TaskFlowApp] Bridge snapshot received');
    console.log('[TaskFlowApp] Snapshot tasks count:', (snapshot.data as Record<string, unknown>)?.tasks ? ((snapshot.data as Record<string, unknown>).tasks as unknown[]).length : 0);
    currentSnapshot = snapshot;
    if (config.onSnapshotChange) {
      console.log('[TaskFlowApp] Calling onSnapshotChange callback');
      config.onSnapshotChange(snapshot);
    }
  });

  // Helper to dispatch intents
  const dispatchIntent = async (body: IntentBody, actor?: ActorRef) => {
    console.log('[TaskFlowApp] ========== DISPATCH START ==========');
    console.log('[TaskFlowApp] dispatchIntent:', body.type);
    console.log('[TaskFlowApp] dispatchIntent body:', JSON.stringify(body, null, 2));
    if (disposed) {
      console.error('[TaskFlowApp] App is disposed!');
      throw new Error("TaskFlowApp has been disposed");
    }
    try {
      console.log('[TaskFlowApp] Calling bridge.dispatch...');
      // dispatch(body, source?, actor?) - pass undefined for source
      await bridge.dispatch(body, undefined, actor);
      console.log('[TaskFlowApp] ========== DISPATCH COMPLETE ==========');
      console.log('[TaskFlowApp] Current snapshot after dispatch:', bridge.getSnapshot()?.data);
    } catch (err) {
      console.error('[TaskFlowApp] ========== DISPATCH ERROR ==========');
      console.error('[TaskFlowApp] dispatch error for:', body.type, err);
      throw err;
    }
  };

  // Helper to get state from snapshot
  const getState = (): TaskFlowState | null => {
    if (!currentSnapshot) return null;
    const data = currentSnapshot.data as Record<string, unknown>;
    return {
      tasks: (data.tasks ?? []) as Task[],
      currentFilter: (data.currentFilter ?? { status: null, priority: null, assignee: null }) as Filter,
      selectedTaskId: (data.selectedTaskId ?? null) as string | null,
      viewMode: (data.viewMode ?? "kanban") as ViewMode,
      isCreating: (data.isCreating ?? false) as boolean,
      isEditing: (data.isEditing ?? false) as boolean,
      activeTasks: (data.activeTasks ?? null) as Task[] | null,
      todoTasks: (data.todoTasks ?? null) as Task[] | null,
      inProgressTasks: (data.inProgressTasks ?? null) as Task[] | null,
      reviewTasks: (data.reviewTasks ?? null) as Task[] | null,
      doneTasks: (data.doneTasks ?? null) as Task[] | null,
      deletedTasks: (data.deletedTasks ?? null) as Task[] | null,
    };
  };

  // Helper to get computed values
  const getComputed = (): TaskFlowComputed | null => {
    if (!currentSnapshot) return null;
    const computed = currentSnapshot.computed as Record<string, unknown>;
    return {
      totalCount: (computed.totalCount ?? 0) as number,
      todoCount: (computed.todoCount ?? 0) as number,
      inProgressCount: (computed.inProgressCount ?? 0) as number,
      reviewCount: (computed.reviewCount ?? 0) as number,
      doneCount: (computed.doneCount ?? 0) as number,
      deletedCount: (computed.deletedCount ?? 0) as number,
      hasSelection: (computed.hasSelection ?? false) as boolean,
      canCreate: (computed.canCreate ?? true) as boolean,
      canEdit: (computed.canEdit ?? false) as boolean,
      canDelete: (computed.canDelete ?? false) as boolean,
    };
  };

  return {
    taskFlowWorld,
    bridge,

    initialize: async () => {
      // Initialize world (create genesis)
      await taskFlowWorld.initialize();
      // Refresh bridge to get initial snapshot
      await bridge.refresh();
      // Run initial filter refresh
      await dispatchIntent({ type: "refreshFilters" });
    },

    subscribe: (callback) => {
      return bridge.subscribe(callback);
    },

    getSnapshot: () => currentSnapshot,
    getState,
    getComputed,

    dispatch: dispatchIntent,

    registerAssistant: (sessionId) => {
      return taskFlowWorld.registerAssistant(sessionId);
    },

    getUserActor: () => taskFlowWorld.userActor,

    dispose: () => {
      disposed = true;
      unsubscribeBridge();
      bridge.dispose();
    },

    // === Action Methods ===

    createTask: async (params) => {
      console.log('[TaskFlowApp] createTask called with:', params);
      try {
        await dispatchIntent({
          type: "createTask",
          input: {
            title: params.title,
            description: params.description ?? null,
            priority: params.priority ?? "medium",
            dueDate: params.dueDate ?? null,
            tags: params.tags ?? [],
          },
        });
        console.log('[TaskFlowApp] createTask intent dispatched');
        // Refresh filters after creation
        await dispatchIntent({ type: "refreshFilters" });
        console.log('[TaskFlowApp] filters refreshed');
      } catch (err) {
        console.error('[TaskFlowApp] createTask error:', err);
        throw err;
      }
    },

    updateTask: async (params) => {
      await dispatchIntent({
        type: "updateTask",
        input: {
          id: params.id,
          title: params.title ?? null,
          description: params.description ?? null,
          priority: params.priority ?? null,
          dueDate: params.dueDate ?? null,
        },
      });
      await dispatchIntent({ type: "refreshFilters" });
    },

    deleteTask: async (id) => {
      await dispatchIntent({
        type: "deleteTask",
        input: { id },
      });
      await dispatchIntent({ type: "refreshFilters" });
    },

    moveTask: async (id, status) => {
      await dispatchIntent({
        type: "moveTask",
        input: { id, newStatus: status },
      });
      await dispatchIntent({ type: "refreshFilters" });
    },

    selectTask: async (taskId) => {
      await dispatchIntent({
        type: "selectTask",
        input: { taskId },
      });
    },

    changeView: async (viewMode) => {
      await dispatchIntent({
        type: "changeView",
        input: { viewMode },
      });
    },

    restoreTask: async (id) => {
      await dispatchIntent({
        type: "restoreTask",
        input: { id },
      });
      await dispatchIntent({ type: "refreshFilters" });
    },

    refreshFilters: async () => {
      await dispatchIntent({ type: "refreshFilters" });
    },

    setFilter: async (status, priority) => {
      await dispatchIntent({
        type: "setFilter",
        input: { status, priority },
      });
    },

    clearFilter: async () => {
      await dispatchIntent({ type: "clearFilter" });
    },
  };
}

/**
 * Singleton app instance (for React provider)
 */
let appInstance: TaskFlowApp | null = null;

/**
 * Get or create the singleton app instance
 */
export async function getTaskFlowApp(config?: TaskFlowAppConfig): Promise<TaskFlowApp> {
  if (!appInstance) {
    appInstance = await createTaskFlowApp(config);
    await appInstance.initialize();
  }
  return appInstance;
}

/**
 * Reset the singleton app instance (for testing)
 */
export function resetTaskFlowApp(): void {
  if (appInstance) {
    appInstance.dispose();
    appInstance = null;
  }
}
