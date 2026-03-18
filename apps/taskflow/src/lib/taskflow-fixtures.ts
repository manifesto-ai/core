import type { AssistantMessage, Task } from "@/types/taskflow";

export const TASK_FIXTURES: Task[] = [
  {
    id: "task-1",
    title: "Map the current TaskFlow shell",
    description:
      "Keep the visible layout while removing state, agent, and persistence layers.",
    status: "todo",
    priority: "high",
    assignee: "Core Team",
    dueDate: "2026-03-21T09:00:00.000Z",
    tags: ["shell", "cleanup"],
    createdAt: "2026-03-15T08:30:00.000Z",
    updatedAt: "2026-03-15T08:30:00.000Z",
    deletedAt: null,
  },
  {
    id: "task-2",
    title: "Convert views to props-only components",
    description:
      "Each surviving UI piece should render from explicit props with no store imports.",
    status: "in-progress",
    priority: "high",
    assignee: "UI Team",
    dueDate: "2026-03-22T17:00:00.000Z",
    tags: ["ui", "props"],
    createdAt: "2026-03-14T11:00:00.000Z",
    updatedAt: "2026-03-16T14:45:00.000Z",
    deletedAt: null,
  },
  {
    id: "task-3",
    title: "Document rebuild boundaries",
    description:
      "Clarify which layers return in the SDK rebuild and which ones stay deleted.",
    status: "review",
    priority: "medium",
    assignee: null,
    dueDate: "2026-03-25T15:30:00.000Z",
    tags: ["docs"],
    createdAt: "2026-03-10T13:00:00.000Z",
    updatedAt: "2026-03-17T09:15:00.000Z",
    deletedAt: null,
  },
  {
    id: "task-4",
    title: "Preserve theme and motion primitives",
    description: "Non-domain presentation assets should remain untouched.",
    status: "done",
    priority: "low",
    assignee: "Design",
    dueDate: null,
    tags: ["theme", "motion"],
    createdAt: "2026-03-08T07:45:00.000Z",
    updatedAt: "2026-03-12T18:10:00.000Z",
    deletedAt: null,
  },
  {
    id: "task-5",
    title: "Retire legacy runtime code",
    description:
      "This item is intentionally in trash to keep the empty-state UI visible during rebuild prep.",
    status: "done",
    priority: "medium",
    assignee: null,
    dueDate: null,
    tags: ["legacy", "trash"],
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-11T16:00:00.000Z",
    deletedAt: "2026-03-17T06:00:00.000Z",
  },
];

export const ASSISTANT_SHELL_MESSAGES: AssistantMessage[] = [
  {
    id: "assistant-1",
    role: "assistant",
    tone: "muted",
    content:
      "Assistant automation is disabled in this shell. Reconnect this panel during the SDK rebuild.",
  },
];
