/**
 * MCP Server Wrapper for Experiments
 *
 * Provides stateful MCP tool execution with format converters for
 * OpenAI Functions, Claude Tools, and LangChain.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type {
  Task,
  TaskStatus,
  TaskPriority,
  ExperimentState,
  MCPServerInstance,
  MCPToolResult,
  OpenAITool,
  ClaudeTool,
} from '../types';

// ============================================
// Tool Schemas (Zod)
// ============================================

const TaskCreateSchema = z.object({
  title: z.string().describe('Task title'),
  description: z.string().optional().describe('Task description'),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format'),
  tags: z.array(z.string()).optional().default([]),
  assignee: z.string().optional().describe('Assignee name'),
});

const CreateTaskSchema = z.object({
  tasks: z.array(TaskCreateSchema).describe('Tasks to create'),
});

const UpdateTaskSchema = z.object({
  id: z.string().describe('Task ID to update'),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  assignee: z.string().nullable().optional(),
});

const ChangeStatusSchema = z.object({
  id: z.string().describe('Task ID'),
  status: z.enum(['todo', 'in-progress', 'review', 'done']),
});

const BulkChangeStatusSchema = z.object({
  ids: z.array(z.string()).describe('Task IDs to change'),
  status: z.enum(['todo', 'in-progress', 'review', 'done']),
});

const DeleteTaskSchema = z.object({
  ids: z.array(z.string()).describe('Task IDs to delete'),
});

const RestoreTaskSchema = z.object({
  id: z.string().describe('Task ID to restore'),
});

const ListTasksSchema = z.object({
  status: z.enum(['all', 'todo', 'in-progress', 'review', 'done']).optional().default('all'),
  includeDeleted: z.boolean().optional().default(false),
});

const SetFilterSchema = z.object({
  status: z.enum(['all', 'todo', 'in-progress', 'review', 'done']).nullable().optional(),
  priority: z.enum(['all', 'low', 'medium', 'high']).nullable().optional(),
});

const ChangeViewSchema = z.object({
  viewMode: z.enum(['todo', 'kanban', 'table']),
});

// ============================================
// Tool Definitions
// ============================================

interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType;
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'create_task',
    description: 'Create one or more tasks with title, description, priority, due date, and tags',
    schema: CreateTaskSchema,
  },
  {
    name: 'update_task',
    description: 'Update an existing task. Only provided fields will be updated.',
    schema: UpdateTaskSchema,
  },
  {
    name: 'change_status',
    description: 'Change the status of a single task',
    schema: ChangeStatusSchema,
  },
  {
    name: 'bulk_change_status',
    description: 'Change the status of multiple tasks at once',
    schema: BulkChangeStatusSchema,
  },
  {
    name: 'delete_task',
    description: 'Soft delete one or more tasks (can be restored later)',
    schema: DeleteTaskSchema,
  },
  {
    name: 'restore_task',
    description: 'Restore a deleted task from trash',
    schema: RestoreTaskSchema,
  },
  {
    name: 'list_tasks',
    description: 'List all tasks with optional filtering by status',
    schema: ListTasksSchema,
  },
  {
    name: 'set_filter',
    description: 'Set filter for task view (status and/or priority)',
    schema: SetFilterSchema,
  },
  {
    name: 'clear_filter',
    description: 'Clear all filters and show all tasks',
    schema: z.object({}),
  },
  {
    name: 'change_view',
    description: 'Change the view mode (kanban, table, or todo list)',
    schema: ChangeViewSchema,
  },
];

// ============================================
// MCP Server Instance Factory
// ============================================

export function createMCPServerInstance(initialState?: ExperimentState): MCPServerInstance {
  let state: ExperimentState = initialState
    ? JSON.parse(JSON.stringify(initialState))
    : {
        tasks: [],
        viewMode: 'kanban',
        currentFilter: { status: null, priority: null },
      };

  // ID generator
  let idCounter = 0;
  const generateId = () => `task-exp-${Date.now()}-${idCounter++}`;

  // Tool implementations
  const toolHandlers: Record<string, (args: unknown) => MCPToolResult> = {
    create_task: (args) => {
      const parsed = CreateTaskSchema.parse(args);
      const now = new Date().toISOString();
      const createdIds: string[] = [];

      for (const taskDef of parsed.tasks) {
        const task: Task = {
          id: generateId(),
          title: taskDef.title,
          description: taskDef.description ?? null,
          status: 'todo',
          priority: taskDef.priority ?? 'medium',
          assignee: taskDef.assignee ?? null,
          dueDate: taskDef.dueDate ?? null,
          tags: taskDef.tags ?? [],
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        state.tasks.push(task);
        createdIds.push(task.id);
      }

      return {
        success: true,
        message: `Created ${createdIds.length} task(s)`,
        data: { taskIds: createdIds },
      };
    },

    update_task: (args) => {
      const parsed = UpdateTaskSchema.parse(args);
      const task = state.tasks.find((t) => t.id === parsed.id);

      if (!task) {
        return { success: false, error: `Task not found: ${parsed.id}` };
      }

      const now = new Date().toISOString();
      if (parsed.title !== undefined) task.title = parsed.title;
      if (parsed.description !== undefined) task.description = parsed.description;
      if (parsed.priority !== undefined) task.priority = parsed.priority;
      if (parsed.dueDate !== undefined) task.dueDate = parsed.dueDate;
      if (parsed.tags !== undefined) task.tags = parsed.tags;
      if (parsed.assignee !== undefined) task.assignee = parsed.assignee;
      task.updatedAt = now;

      return { success: true, message: `Updated task: ${task.title}` };
    },

    change_status: (args) => {
      const parsed = ChangeStatusSchema.parse(args);
      const task = state.tasks.find((t) => t.id === parsed.id);

      if (!task) {
        return { success: false, error: `Task not found: ${parsed.id}` };
      }

      task.status = parsed.status;
      task.updatedAt = new Date().toISOString();

      return { success: true, message: `Changed status to ${parsed.status}: ${task.title}` };
    },

    bulk_change_status: (args) => {
      const parsed = BulkChangeStatusSchema.parse(args);
      const now = new Date().toISOString();
      let updated = 0;

      for (const id of parsed.ids) {
        const task = state.tasks.find((t) => t.id === id);
        if (task && !task.deletedAt) {
          task.status = parsed.status;
          task.updatedAt = now;
          updated++;
        }
      }

      return {
        success: true,
        message: `Changed ${updated} task(s) to ${parsed.status}`,
        data: { updatedCount: updated },
      };
    },

    delete_task: (args) => {
      const parsed = DeleteTaskSchema.parse(args);
      const now = new Date().toISOString();
      let deleted = 0;

      for (const id of parsed.ids) {
        const task = state.tasks.find((t) => t.id === id);
        if (task && !task.deletedAt) {
          task.deletedAt = now;
          deleted++;
        }
      }

      return {
        success: true,
        message: `Deleted ${deleted} task(s)`,
        data: { deletedCount: deleted },
      };
    },

    restore_task: (args) => {
      const parsed = RestoreTaskSchema.parse(args);
      const task = state.tasks.find((t) => t.id === parsed.id);

      if (!task) {
        return { success: false, error: `Task not found: ${parsed.id}` };
      }

      if (!task.deletedAt) {
        return { success: false, error: `Task is not deleted: ${parsed.id}` };
      }

      task.deletedAt = null;
      task.updatedAt = new Date().toISOString();

      return { success: true, message: `Restored task: ${task.title}` };
    },

    list_tasks: (args) => {
      const parsed = ListTasksSchema.parse(args);
      let tasks = state.tasks;

      if (!parsed.includeDeleted) {
        tasks = tasks.filter((t) => !t.deletedAt);
      }

      if (parsed.status !== 'all') {
        tasks = tasks.filter((t) => t.status === parsed.status);
      }

      return {
        success: true,
        data: {
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            assignee: t.assignee,
            dueDate: t.dueDate,
            tags: t.tags,
          })),
          total: tasks.length,
        },
      };
    },

    set_filter: (args) => {
      const parsed = SetFilterSchema.parse(args);

      if (parsed.status !== undefined) {
        state.currentFilter.status = parsed.status === 'all' ? null : (parsed.status as TaskStatus);
      }
      if (parsed.priority !== undefined) {
        state.currentFilter.priority =
          parsed.priority === 'all' ? null : (parsed.priority as TaskPriority);
      }

      return { success: true, message: 'Filter updated' };
    },

    clear_filter: () => {
      state.currentFilter = { status: null, priority: null };
      return { success: true, message: 'Filters cleared' };
    },

    change_view: (args) => {
      const parsed = ChangeViewSchema.parse(args);
      state.viewMode = parsed.viewMode;
      return { success: true, message: `View changed to ${parsed.viewMode}` };
    },
  };

  return {
    resetState(newState: ExperimentState): void {
      state = JSON.parse(JSON.stringify(newState));
      idCounter = 0;
    },

    getState(): ExperimentState {
      return JSON.parse(JSON.stringify(state));
    },

    async executeTool(name: string, args: unknown): Promise<MCPToolResult> {
      const handler = toolHandlers[name];
      if (!handler) {
        return { success: false, error: `Unknown tool: ${name}` };
      }

      try {
        return handler(args);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    getToolsAsOpenAI(): OpenAITool[] {
      return TOOL_DEFINITIONS.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: zodToJsonSchema(tool.schema as any, { target: 'openApi3' }) as Record<string, unknown>,
        },
      }));
    },

    getToolsAsClaude(): ClaudeTool[] {
      return TOOL_DEFINITIONS.map((tool) => {
        const schema = zodToJsonSchema(tool.schema as any, { target: 'openApi3' }) as Record<string, unknown>;
        return {
          name: tool.name,
          description: tool.description,
          input_schema: {
            type: 'object' as const,
            properties: (schema.properties || {}) as Record<string, unknown>,
            required: (schema.required || []) as string[],
          },
        };
      });
    },

    getToolNames(): string[] {
      return TOOL_DEFINITIONS.map((t) => t.name);
    },
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Find task by title substring (for contextual matching)
 */
export function findTaskByTitle(state: ExperimentState, titleHint: string): Task | undefined {
  const hint = titleHint.toLowerCase();
  return state.tasks.find((t) => t.title.toLowerCase().includes(hint) && !t.deletedAt);
}

/**
 * Find tasks by assignee
 */
export function findTasksByAssignee(state: ExperimentState, assignee: string): Task[] {
  return state.tasks.filter(
    (t) => t.assignee?.toLowerCase() === assignee.toLowerCase() && !t.deletedAt
  );
}

/**
 * Find tasks by tag
 */
export function findTasksByTag(state: ExperimentState, tag: string): Task[] {
  return state.tasks.filter(
    (t) => t.tags.some((tg) => tg.toLowerCase() === tag.toLowerCase()) && !t.deletedAt
  );
}

/**
 * Find tasks by status
 */
export function findTasksByStatus(state: ExperimentState, status: TaskStatus): Task[] {
  return state.tasks.filter((t) => t.status === status && !t.deletedAt);
}
