#!/usr/bin/env node
/**
 * TaskFlow MCP Server
 *
 * Pure JavaScript MCP server - no tsx required.
 * Run with: node src/mcp/server.mjs
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_BASE = process.env.TASKFLOW_API_URL || 'http://localhost:3000';

// In-memory snapshot for MCP
let snapshot = {
  data: { tasks: [] },
  state: {
    lastCreatedTaskIds: [],
    lastModifiedTaskId: null,
  },
};

function generateTaskId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Create server
const server = new McpServer({
  name: 'taskflow',
  version: '1.0.0',
});

// Tool: create_task
server.tool(
  'create_task',
  'Create one or more tasks',
  {
    tasks: z.array(z.object({
      title: z.string().describe('Task title'),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      dueDate: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })),
  },
  async ({ tasks }) => {
    const createdIds = [];
    for (const t of tasks) {
      const task = {
        id: generateTaskId(),
        title: t.title,
        description: t.description || '',
        status: 'todo',
        priority: t.priority || 'medium',
        dueDate: t.dueDate || null,
        assignee: null,
        tags: t.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      };
      snapshot.data.tasks.push(task);
      createdIds.push(task.id);
    }
    snapshot.state.lastCreatedTaskIds = createdIds;
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: true, taskIds: createdIds, message: `Created ${tasks.length} task(s)` }, null, 2) }],
    };
  }
);

// Tool: list_tasks
server.tool(
  'list_tasks',
  'List all tasks with optional filtering',
  {
    status: z.enum(['todo', 'in-progress', 'review', 'done', 'all']).optional().default('all'),
    includeDeleted: z.boolean().optional().default(false),
  },
  async ({ status, includeDeleted }) => {
    let tasks = snapshot.data.tasks;
    if (!includeDeleted) {
      tasks = tasks.filter(t => !t.deletedAt);
    }
    if (status && status !== 'all') {
      tasks = tasks.filter(t => t.status === status);
    }
    const result = {
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        assignee: t.assignee,
        tags: t.tags,
      })),
      summary: {
        total: tasks.length,
        todo: tasks.filter(t => t.status === 'todo').length,
        inProgress: tasks.filter(t => t.status === 'in-progress').length,
        review: tasks.filter(t => t.status === 'review').length,
        done: tasks.filter(t => t.status === 'done').length,
      },
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool: update_task
server.tool(
  'update_task',
  'Update task properties',
  {
    taskId: z.string().describe('Task ID'),
    title: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    dueDate: z.string().nullable().optional(),
    assignee: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
  },
  async ({ taskId, title, description, priority, dueDate, assignee, tags }) => {
    const task = snapshot.data.tasks.find(t => t.id === taskId);
    if (!task) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `Task ${taskId} not found` }) }] };
    }
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (assignee !== undefined) task.assignee = assignee;
    if (tags !== undefined) task.tags = tags;
    task.updatedAt = new Date().toISOString();
    snapshot.state.lastModifiedTaskId = taskId;
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Task updated' }, null, 2) }] };
  }
);

// Tool: change_status
server.tool(
  'change_status',
  'Change task status (todo, in-progress, review, done)',
  {
    taskId: z.string(),
    status: z.enum(['todo', 'in-progress', 'review', 'done']),
  },
  async ({ taskId, status }) => {
    const task = snapshot.data.tasks.find(t => t.id === taskId);
    if (!task) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `Task ${taskId} not found` }) }] };
    }
    task.status = status;
    task.updatedAt = new Date().toISOString();
    snapshot.state.lastModifiedTaskId = taskId;
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Status changed to ${status}` }, null, 2) }] };
  }
);

// Tool: delete_task
server.tool(
  'delete_task',
  'Delete one or more tasks (soft delete)',
  {
    taskIds: z.array(z.string()).describe('Task IDs to delete'),
  },
  async ({ taskIds }) => {
    let deletedCount = 0;
    for (const id of taskIds) {
      const task = snapshot.data.tasks.find(t => t.id === id);
      if (task) {
        task.deletedAt = new Date().toISOString();
        deletedCount++;
      }
    }
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Deleted ${deletedCount} task(s)`, deletedCount }, null, 2) }] };
  }
);

// Tool: restore_task
server.tool(
  'restore_task',
  'Restore a deleted task',
  {
    taskId: z.string(),
  },
  async ({ taskId }) => {
    const task = snapshot.data.tasks.find(t => t.id === taskId);
    if (!task) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, message: `Task ${taskId} not found` }) }] };
    }
    task.deletedAt = null;
    task.updatedAt = new Date().toISOString();
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Task restored' }, null, 2) }] };
  }
);

// Tool: bulk_change_status
server.tool(
  'bulk_change_status',
  'Change status of multiple tasks at once',
  {
    taskIds: z.array(z.string()),
    status: z.enum(['todo', 'in-progress', 'review', 'done']),
  },
  async ({ taskIds, status }) => {
    let successCount = 0;
    for (const id of taskIds) {
      const task = snapshot.data.tasks.find(t => t.id === id);
      if (task) {
        task.status = status;
        task.updatedAt = new Date().toISOString();
        successCount++;
      }
    }
    return { content: [{ type: 'text', text: JSON.stringify({ success: successCount > 0, message: `Updated ${successCount}/${taskIds.length} tasks`, updatedCount: successCount }, null, 2) }] };
  }
);

// Tool: chat - Natural language interface
server.tool(
  'chat',
  'Process natural language commands for task management. Examples: "오늘 할 일 3개 만들어줘", "회의 준비 태스크 추가해줘", "모든 태스크 보여줘"',
  {
    message: z.string().describe('Natural language command in any language'),
  },
  async ({ message }) => {
    try {
      // Call Next.js API
      const response = await fetch(`${API_BASE}/api/agent/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: message,
          snapshot: {
            data: snapshot.data,
            state: snapshot.state,
          },
        }),
      });

      if (!response.ok) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: false,
            error: `API error: ${response.status}`,
            hint: 'Make sure TaskFlow web app is running (pnpm dev)'
          }) }],
        };
      }

      // Parse SSE response
      // Format: event: <type>\ndata: <json>\n\n
      const text = await response.text();
      const lines = text.split('\n');

      let assistantMessage = '';
      let effects = [];
      let currentEvent = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ') && currentEvent === 'done') {
          try {
            const data = JSON.parse(line.slice(6));
            assistantMessage = data.message || '';
            effects = data.effects || [];
          } catch (e) {
            // Skip non-JSON lines
          }
        }
      }

      // Apply effects to local snapshot
      for (const effect of effects) {
        if (effect.type === 'snapshot.patch' && effect.ops) {
          for (const op of effect.ops) {
            if (op.op === 'append' && op.path === 'data.tasks') {
              const task = { ...op.value, id: op.value.id || generateTaskId() };
              snapshot.data.tasks.push(task);
              snapshot.state.lastCreatedTaskIds.push(task.id);
            } else if (op.op === 'set') {
              const idMatch = op.path.match(/data\.tasks\.id:([^.]+)\.(\w+)/);
              if (idMatch) {
                const [, taskId, field] = idMatch;
                const task = snapshot.data.tasks.find(t => t.id === taskId);
                if (task) {
                  task[field] = op.value;
                  snapshot.state.lastModifiedTaskId = taskId;
                }
              }
            } else if (op.op === 'remove' && op.path === 'data.tasks') {
              const task = snapshot.data.tasks.find(t => t.id === op.value);
              if (task) task.deletedAt = new Date().toISOString();
            }
          }
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: true,
          message: assistantMessage,
          effectsApplied: effects.length,
          currentTasks: snapshot.data.tasks.filter(t => !t.deletedAt).map(t => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
          })),
        }, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false,
          error: error.message,
          hint: 'Make sure TaskFlow web app is running at ' + API_BASE,
        }) }],
      };
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('TaskFlow MCP Server started');
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
