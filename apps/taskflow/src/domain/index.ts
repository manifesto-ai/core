/**
 * TaskFlow Domain
 *
 * Compiled domain schema from MEL source (tasks.mel).
 * This provides the full action definitions for Manifesto Core.
 */

// Import compiled domain schema
import compiledSchema from "./tasks-compiled.json";

// Export types
export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in-progress" | "review" | "done";
  priority: "low" | "medium" | "high";
  assignee: string | null;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Filter = {
  status: "all" | "todo" | "in-progress" | "review" | "done" | null;
  priority: "all" | "low" | "medium" | "high" | null;
  assignee: string | null;
};

export type ViewMode = "todo" | "kanban" | "table" | "trash";

/**
 * Tasks domain schema (compiled from MEL)
 */
export const TasksDomain = compiledSchema;

// Initial state for the domain
export const initialSnapshot = {
  data: {
    tasks: [] as Task[],
    currentFilter: { status: null, priority: null, assignee: null } as Filter,
  },
  state: {
    selectedTaskId: null as string | null,
    viewMode: "kanban" as ViewMode,
    isCreating: false,
    isEditing: false,
    // Intent markers for re-entry safety
    createIntent: null as string | null,
    updateIntent: null as string | null,
    deleteIntent: null as string | null,
    moveIntent: null as string | null,
    // Filter step markers
    filterStep1: null as string | null,
    filterStep2: null as string | null,
    filterStep3: null as string | null,
    filterStep4: null as string | null,
    filterStep5: null as string | null,
    filterStep6: null as string | null,
    // Derived arrays (populated by effects)
    activeTasks: null as Task[] | null,
    todoTasks: null as Task[] | null,
    inProgressTasks: null as Task[] | null,
    reviewTasks: null as Task[] | null,
    doneTasks: null as Task[] | null,
    deletedTasks: null as Task[] | null,
  },
};
