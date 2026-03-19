/**
 * Intent types for the LLM Intent Compiler.
 *
 * These map 1:1 to Manifesto actions defined in the MEL domain.
 * The LLM compiles natural language into one of these intents,
 * which is then dispatched to the Manifesto runtime.
 */

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type ViewMode = 'kanban' | 'todo' | 'table' | 'trash';

export type IntentResult =
  | CreateTaskIntent
  | UpdateTaskIntent
  | MoveTaskIntent
  | DeleteTaskIntent
  | RestoreTaskIntent
  | EmptyTrashIntent
  | SelectTaskIntent
  | ChangeViewIntent
  | QueryIntent;

export interface CreateTaskIntent {
  kind: 'createTask';
  task: {
    title: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    assignee?: string | null;
    dueDate?: string | null;
    tags?: string[];
  };
}

export interface UpdateTaskIntent {
  kind: 'updateTask';
  taskTitle: string;
  fields: {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    assignee?: string | null;
    dueDate?: string | null;
    tags?: string[];
  };
}

export interface MoveTaskIntent {
  kind: 'moveTask';
  taskTitle: string;
  newStatus: TaskStatus;
}

export interface DeleteTaskIntent {
  kind: 'deleteTask';
  taskTitle: string;
}

export interface RestoreTaskIntent {
  kind: 'restoreTask';
  taskTitle: string;
}

export interface EmptyTrashIntent {
  kind: 'emptyTrash';
}

export interface SelectTaskIntent {
  kind: 'selectTask';
  taskTitle: string | null;
}

export interface ChangeViewIntent {
  kind: 'changeView';
  viewMode: ViewMode;
}

export interface QueryIntent {
  kind: 'query';
  question: string;
  answer?: string;
}

/** API request body */
export interface AgentRequest {
  message: string;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    deletedAt: string | null;
  }>;
  viewMode: string;
}

/** API response body */
export interface AgentResponse {
  intent: IntentResult | null;
  message: string;
  executed: boolean;
}
