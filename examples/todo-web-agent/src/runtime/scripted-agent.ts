import { addTodo, clearCompleted, toggleTodo } from "./todo-actions";
import { readTodoView } from "./manifesto-app";
import type { AgentLogEntry, AgentLogTone, TodoApp, TodoView, TodoWriteResponse } from "../types";

export type DemoCaption =
  | "idle"
  | "prompt"
  | "read"
  | "available"
  | "write"
  | "settled"
  | "done";

export type ScriptStep =
  | {
      readonly kind: "log";
      readonly caption: DemoCaption;
      readonly label: string;
      readonly detail: string;
      readonly tone: AgentLogTone;
      readonly waitMs: number;
    }
  | {
      readonly kind: "read";
      readonly caption: DemoCaption;
      readonly waitMs: number;
    }
  | {
      readonly kind: "action";
      readonly caption: DemoCaption;
      readonly label: string;
      readonly detail: string;
      readonly highlightTodoId?: string;
      readonly run: (app: TodoApp) => Promise<TodoWriteResponse>;
      readonly waitMs: number;
    };

export const SCRIPTED_AGENT_STEPS: readonly ScriptStep[] = [
  {
    kind: "log",
    caption: "prompt",
    label: "user",
    detail: "Clean up my todo list.",
    tone: "neutral",
    waitMs: 700,
  },
  {
    kind: "read",
    caption: "read",
    waitMs: 800,
  },
  {
    kind: "log",
    caption: "available",
    label: "inspect.availableActions",
    detail: "addTodo, toggleTodo, removeTodo, setFilter, clearCompleted",
    tone: "read",
    waitMs: 900,
  },
  {
    kind: "action",
    caption: "write",
    label: "tool.toggleTodo",
    detail: '{ id: "draft-launch-post" }',
    highlightTodoId: "draft-launch-post",
    run: (app) => toggleTodo(app, "draft-launch-post"),
    waitMs: 900,
  },
  {
    kind: "action",
    caption: "write",
    label: "tool.clearCompleted",
    detail: "{}",
    run: (app) => clearCompleted(app),
    waitMs: 900,
  },
  {
    kind: "action",
    caption: "write",
    label: "tool.addTodo",
    detail: '{ title: "Publish Manifesto demo" }',
    highlightTodoId: "publish-demo",
    run: (app) => addTodo(app, "Publish Manifesto demo"),
    waitMs: 900,
  },
  {
    kind: "log",
    caption: "settled",
    label: "outcome",
    detail: "ok; Snapshot and computed values updated",
    tone: "ok",
    waitMs: 1200,
  },
  {
    kind: "log",
    caption: "done",
    label: "Manifesto",
    detail: "Deterministic app state for AI agents.",
    tone: "read",
    waitMs: 0,
  },
];

export function createReadLog(id: number, app: TodoApp): AgentLogEntry {
  const view = readTodoView(app);
  const actionNames = view.availableActions.map((action) => action.name).join(", ");

  return {
    id,
    at: "read",
    label: "readTodoContext",
    detail: `${view.state.todos.length} todos; available: ${actionNames}`,
    tone: "read",
  };
}

export type ScriptedAgentFinalFrame = {
  readonly entries: readonly AgentLogEntry[];
  readonly latestResponse: TodoWriteResponse | null;
  readonly view: TodoView;
};

const SCRIPTED_AGENT_FINAL_VIEW: TodoView = {
  state: {
    todos: [
      { id: "record-demo", title: "Record agent demo", completed: false },
      { id: "publish-demo", title: "Publish Manifesto demo", completed: false },
    ],
    filterMode: "all",
    nextTodoId: "publish-demo",
  },
  computed: {
    todoCount: 2,
    completedCount: 0,
    activeCount: 2,
    hasCompleted: false,
  },
  availableActions: [
    {
      name: "addTodo",
      parameters: [{ name: "title", required: true, type: "string" }],
    },
    {
      name: "toggleTodo",
      parameters: [{ name: "id", required: true, type: "string" }],
    },
    {
      name: "removeTodo",
      parameters: [{ name: "id", required: true, type: "string" }],
    },
    {
      name: "setFilter",
      parameters: [{ name: "newFilter", required: true, type: "string" }],
    },
  ],
};

export const SCRIPTED_AGENT_FINAL_FRAME: ScriptedAgentFinalFrame = {
  entries: [
    {
      id: 4,
      at: "tool",
      label: "tool.toggleTodo",
      detail: '{ id: "draft-launch-post" }',
      tone: "neutral",
    },
    {
      id: 5,
      at: "result",
      label: "toggleTodo",
      detail: "outcome: ok",
      tone: "ok",
    },
    {
      id: 6,
      at: "tool",
      label: "tool.clearCompleted",
      detail: "{}",
      tone: "neutral",
    },
    {
      id: 7,
      at: "result",
      label: "clearCompleted",
      detail: "outcome: ok",
      tone: "ok",
    },
    {
      id: 8,
      at: "tool",
      label: "tool.addTodo",
      detail: '{ title: "Publish Manifesto demo" }',
      tone: "neutral",
    },
    {
      id: 9,
      at: "result",
      label: "addTodo",
      detail: "outcome: ok",
      tone: "ok",
    },
    {
      id: 10,
      at: "settled",
      label: "outcome",
      detail: "ok; Snapshot and computed values updated",
      tone: "ok",
    },
    {
      id: 11,
      at: "done",
      label: "Manifesto",
      detail: "Deterministic app state for AI agents.",
      tone: "read",
    },
  ],
  latestResponse: {
    status: "settled",
    action: "addTodo",
    outcome: { kind: "ok" },
    report: {
      mode: "base",
      action: "addTodo",
      changes: [
        { path: ["computed", "activeCount"], kind: "changed" },
        { path: ["computed", "todoCount"], kind: "changed" },
        { path: ["state", "todos", 1], kind: "set" },
      ],
      requirements: [],
      outcome: { kind: "ok" },
    },
    view: SCRIPTED_AGENT_FINAL_VIEW,
  },
  view: SCRIPTED_AGENT_FINAL_VIEW,
};

export async function runScriptedAgentToFinalFrame(app: TodoApp): Promise<ScriptedAgentFinalFrame> {
  let nextId = 0;
  let latestResponse: TodoWriteResponse | null = null;
  const entries: AgentLogEntry[] = [];

  const nextLogId = () => {
    nextId += 1;
    return nextId;
  };

  const append = (entry: Omit<AgentLogEntry, "id">) => {
    entries.push({ ...entry, id: nextLogId() });
  };

  for (const step of SCRIPTED_AGENT_STEPS) {
    if (step.kind === "log") {
      append({
        at: step.caption,
        label: step.label,
        detail: step.detail,
        tone: step.tone,
      });
      continue;
    }

    if (step.kind === "read") {
      entries.push(createReadLog(nextLogId(), app));
      continue;
    }

    append({
      at: "tool",
      label: step.label,
      detail: step.detail,
      tone: "neutral",
    });
    latestResponse = await step.run(app);
    append({
      at: "result",
      label: latestResponse.action,
      detail: latestResponse.status === "settled" ? "outcome: ok" : latestResponse.status,
      tone: latestResponse.status === "settled" ? "ok" : "warn",
    });
  }

  return {
    entries: entries.slice(-8),
    latestResponse,
    view: readTodoView(app),
  };
}
