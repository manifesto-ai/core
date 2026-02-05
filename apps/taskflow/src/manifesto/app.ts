/**
 * TaskFlow App Setup
 *
 * Creates and configures the Manifesto v2.3.0 App for TaskFlow.
 */

import {
  createApp,
  createDefaultPolicyService,
  createPermissiveScope,
  type App,
  type AppState,
  type PolicyService,
  type Unsubscribe,
} from "@manifesto-ai/app";
import { compileMelDomain } from "@manifesto-ai/compiler";
import type { DomainSchema } from "@manifesto-ai/core";
import type { ActorRef, IntentBody } from "@manifesto-ai/world";

import { TasksDomain, initialSnapshot, type Task, type ViewMode, type Filter } from "../domain";
import { createUserActor, createAssistantActor, defaultActors } from "./actors";
import { defaultPersistence, taskflowEffects, type TaskFlowPersistence } from "./effects";

/**
 * TaskFlow App configuration
 */
export interface TaskFlowAppConfig {
  /**
   * Optional persistence implementation
   */
  persistence?: TaskFlowPersistence;

  /**
   * Initial user ID (creates user actor)
   */
  userId?: string;

  /**
   * Callback for snapshot changes
   */
  onSnapshotChange?: (snapshot: AppState<TaskFlowState>) => void;

  /**
   * Optional policy service override
   */
  policyService?: PolicyService;
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
   * Underlying Manifesto App
   */
  app: App;

  /**
   * Initialize the app
   */
  initialize: () => Promise<void>;

  /**
   * Subscribe to snapshot changes
   */
  subscribe: (callback: (snapshot: AppState<TaskFlowState>) => void) => Unsubscribe;

  /**
   * Get the current snapshot
   */
  getSnapshot: () => AppState<TaskFlowState> | null;

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
   * Import a task (for applying server-generated effects, bypasses guards)
   */
  importTask: (task: Task) => Promise<void>;

  /**
   * Update an existing task
   */
  updateTask: (params: {
    id: string;
    title?: string | null;
    description?: string | null;
    status?: "todo" | "in-progress" | "review" | "done" | null;
    priority?: "low" | "medium" | "high" | null;
    dueDate?: string | null;
    assignee?: string | null;
    tags?: string[] | null;
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

const AGENT_ALLOWED_INTENTS = new Set([
  "selectTask",
  "changeView",
  "createTask",
  "updateTask",
  "moveTask",
  "setFilter",
  "refreshFilters",
]);

const AGENT_DENIED_INTENTS = new Set(["deleteTask", "restoreTask"]);

function createTaskFlowPolicyService(): PolicyService {
  return createDefaultPolicyService({
    warnOnAutoApprove: false,
    authorityHandler: async (proposal) => {
      const actorId = proposal.actorId ?? "";
      const intentType = proposal.intentType;
      const isAgent = actorId.startsWith("agent:");

      if (isAgent) {
        if (AGENT_DENIED_INTENTS.has(intentType)) {
          return {
            approved: false,
            reason: "AI agents are not allowed to perform this action",
            timestamp: Date.now(),
          };
        }

        if (AGENT_ALLOWED_INTENTS.has(intentType)) {
          return {
            approved: true,
            reason: "AI agent action approved",
            scope: createPermissiveScope(),
            timestamp: Date.now(),
          };
        }

        return {
          approved: false,
          reason: "AI agent action rejected by default",
          timestamp: Date.now(),
        };
      }

      return {
        approved: true,
        reason: "Human/system action approved",
        scope: createPermissiveScope(),
        timestamp: Date.now(),
      };
    },
  });
}

// Sample tasks for initial data when persistence is empty
const SAMPLE_TASKS: Task[] = [
  {
    id: "task-1",
    title: "Set up project structure",
    description: "Initialize Next.js app with shadcn/ui",
    status: "done",
    priority: "high",
    tags: ["setup", "infrastructure"],
    assignee: null,
    dueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  },
  {
    id: "task-2",
    title: "Implement Kanban board",
    description: "Create drag and drop Kanban view",
    status: "in-progress",
    priority: "high",
    tags: ["feature", "ui"],
    assignee: "Developer",
    dueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  },
  {
    id: "task-3",
    title: "Add task filtering",
    description: "Filter tasks by status and priority",
    status: "todo",
    priority: "medium",
    tags: ["feature"],
    assignee: null,
    dueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  },
  {
    id: "task-4",
    title: "Write documentation",
    description: "Document the SPEC issues found",
    status: "review",
    priority: "medium",
    tags: ["docs"],
    assignee: null,
    dueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  },
  {
    id: "task-5",
    title: "Add AI agent integration",
    description: "Integrate @manifesto-ai/agent for task assistance",
    status: "todo",
    priority: "low",
    tags: ["feature", "ai"],
    assignee: null,
    dueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  },
];

let compiledTasksSchema: DomainSchema | null = null;

function getTasksDomainSchema(): DomainSchema {
  if (compiledTasksSchema) {
    return compiledTasksSchema;
  }

  const result = compileMelDomain(TasksDomain, { mode: "domain" });

  if (result.errors.length > 0) {
    const errorMessages = result.errors
      .map((error) => `[${error.code}] ${error.message}`)
      .join("; ");
    throw new Error(`TaskFlow MEL compilation failed: ${errorMessages}`);
  }

  if (!result.schema) {
    throw new Error("TaskFlow MEL compilation produced no schema");
  }

  compiledTasksSchema = result.schema as DomainSchema;
  return compiledTasksSchema;
}

async function loadInitialData(
  persistence: TaskFlowPersistence
): Promise<Record<string, unknown>> {
  const tasks = await persistence.loadTasks();
  const initialTasks = tasks.length > 0 ? tasks : SAMPLE_TASKS;
  const baseData = {
    ...(initialSnapshot.data as Record<string, unknown>),
    ...(initialSnapshot.state as Record<string, unknown>),
  };

  return {
    ...baseData,
    tasks: initialTasks,
    currentFilter: baseData.currentFilter ?? { status: null, priority: null, assignee: null },
  };
}

/**
 * Create the TaskFlow App
 */
export async function createTaskFlowApp(
  config: TaskFlowAppConfig = {}
): Promise<TaskFlowApp> {
  const persistence = config.persistence ?? defaultPersistence;
  const initialData = await loadInitialData(persistence);

  const schema = getTasksDomainSchema();

  const userActor = config.userId
    ? createUserActor(config.userId)
    : defaultActors.anonymousUser;

  const policyService = config.policyService ?? createTaskFlowPolicyService();

  // v2.3.0 Effects-first API
  const app = createApp({
    schema,
    effects: taskflowEffects,
    policyService,
    initialData,
    actorPolicy: {
      mode: "anonymous",
      defaultActor: {
        actorId: userActor.actorId,
        kind: userActor.kind,
        name: userActor.name,
        meta: userActor.meta,
      },
    },
  });

  // Track current snapshot
  let currentSnapshot: AppState<TaskFlowState> | null = null;
  let disposed = false;
  let initialized = false;
  let unsubscribe: Unsubscribe | null = null;

  const updateSnapshot = (snapshot: AppState<TaskFlowState>) => {
    currentSnapshot = snapshot;
    config.onSnapshotChange?.(snapshot);
  };

  const dispatchIntent = async (body: IntentBody, actor?: ActorRef) => {
    if (disposed) {
      throw new Error("TaskFlowApp has been disposed");
    }

    const handle = app.act(body.type, body.input, actor ? { actorId: actor.actorId } : undefined);
    await handle.done();
  };

  const getState = (): TaskFlowState | null => {
    if (!currentSnapshot) return null;
    const data = currentSnapshot.data;
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

  const getComputed = (): TaskFlowComputed | null => {
    if (!currentSnapshot) return null;
    const computed = currentSnapshot.computed as Record<string, unknown>;
    return {
      totalCount: (computed["computed.totalCount"] ?? 0) as number,
      todoCount: (computed["computed.todoCount"] ?? 0) as number,
      inProgressCount: (computed["computed.inProgressCount"] ?? 0) as number,
      reviewCount: (computed["computed.reviewCount"] ?? 0) as number,
      doneCount: (computed["computed.doneCount"] ?? 0) as number,
      deletedCount: (computed["computed.deletedCount"] ?? 0) as number,
      hasSelection: (computed["computed.hasSelection"] ?? false) as boolean,
      canCreate: (computed["computed.canCreate"] ?? true) as boolean,
      canEdit: (computed["computed.canEdit"] ?? false) as boolean,
      canDelete: (computed["computed.canDelete"] ?? false) as boolean,
    };
  };

  return {
    app,

    initialize: async () => {
      if (initialized) {
        return;
      }

      await app.ready();
      initialized = true;

      currentSnapshot = app.getState<TaskFlowState>();
      updateSnapshot(currentSnapshot);

      unsubscribe = app.subscribe(
        (state) => state as AppState<TaskFlowState>,
        (state) => updateSnapshot(state as AppState<TaskFlowState>),
        { batchMode: "immediate" }
      );

      app.hooks.on("state:publish", async ({ snapshot }) => {
        const data = snapshot.data as { tasks?: Task[] } | undefined;
        if (Array.isArray(data?.tasks)) {
          await persistence.saveTasks(data.tasks);
        }
      });

      await dispatchIntent({ type: "refreshFilters" });
    },

    subscribe: (callback) => {
      return app.subscribe(
        (state) => state as AppState<TaskFlowState>,
        (state) => callback(state as AppState<TaskFlowState>),
        { batchMode: "immediate" }
      );
    },

    getSnapshot: () => currentSnapshot,
    getState,
    getComputed,

    dispatch: dispatchIntent,

    registerAssistant: (sessionId) => {
      return createAssistantActor(sessionId);
    },

    getUserActor: () => userActor,

    dispose: () => {
      disposed = true;
      unsubscribe?.();
      void app.dispose();
    },

    // === Action Methods ===

    createTask: async (params) => {
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
      await dispatchIntent({ type: "refreshFilters" });
    },

    importTask: async (task) => {
      await dispatchIntent({
        type: "importTask",
        input: { task },
      });
      await dispatchIntent({ type: "refreshFilters" });
    },

    updateTask: async (params) => {
      await dispatchIntent({
        type: "updateTask",
        input: {
          id: params.id,
          title: params.title ?? null,
          description: params.description ?? null,
          status: params.status ?? null,
          priority: params.priority ?? null,
          dueDate: params.dueDate ?? null,
          assignee: params.assignee ?? null,
          tags: params.tags ?? null,
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
        input: { newViewMode: viewMode },
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
