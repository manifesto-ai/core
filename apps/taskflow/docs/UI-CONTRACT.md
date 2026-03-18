# TaskFlow UI Contract

This document captures what the preserved TaskFlow UI needs from the future Manifesto domain.

## Core Data Shape

```ts
type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';
type ViewMode = 'todo' | 'kanban' | 'table' | 'trash';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface DateFilter {
  field: 'dueDate' | 'createdAt';
  type: 'all' | 'today' | 'week' | 'month' | 'custom';
  startDate?: Date;
  endDate?: Date;
}
```

Rule:

- For MEL-facing state, prefer `null` over `undefined` for all optional task fields.

## Required State

- `tasks: Task[]`
- `selectedTaskId: string | null`
- `viewMode: ViewMode`
- `dateFilter: DateFilter | null`
- `assistantOpen: boolean`

Phase 3 only:

- assistant message history / chat history

## Required Computed Values

- `activeTasks`
- `deletedTasks`
- `todoTasks`
- `inProgressTasks`
- `reviewTasks`
- `doneTasks`
- `totalCount`
- `todoCount`
- `inProgressCount`
- `reviewCount`
- `doneCount`
- `selectedTask`

## Required Actions

- `createTask(task)`
- `updateTask(id, updates)`
- `moveTask(taskId, newStatus)`
- `softDeleteTask(id)`
- `restoreTask(id)`
- `permanentlyDeleteTask(id)`
- `emptyTrash()`
- `selectTask(id | null)`
- `changeView(mode)`
- `setDateFilter(filter | null)`
- `toggleAssistant(open)`

## Component Mapping

### `src/app/page.tsx`

Needs:

- `viewMode`
- `selectedTaskId`
- `assistantOpen`
- `dateFilter`
- counts and filtered task lists

### `src/components/views/KanbanView.tsx`

Needs:

- active task list
- selected task id
- select callback
- move callback

### `src/components/views/TodoView.tsx`

Needs:

- active task list
- selected task id
- select callback

### `src/components/views/TableView.tsx`

Needs:

- active task list
- selected task id
- select callback

### `src/components/views/TrashView.tsx`

Needs:

- deleted task list
- restore callback
- permanently delete callback
- empty trash callback

### `src/components/sidebar/TaskDetailPanel.tsx`

Needs:

- selected task
- close callback
- update callback
- delete callback

### `src/components/assistant/*`

Phase 3 only. Preserve the current visual structure, but reconnect the data flow to Manifesto intents instead of any custom agent runtime.
