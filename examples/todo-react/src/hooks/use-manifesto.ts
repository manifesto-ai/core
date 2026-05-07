import { useCallback, useEffect, useRef, useState } from "react";
import {
  createManifesto,
  type ActionName,
  type Admission,
  type BaseWriteReport,
  type ChangedPath,
  type ManifestoApp,
  type SubmitResultFor,
  type PreviewResult,
} from "@manifesto-ai/sdk";

import todoSchema from "../domain/todo.mel";
import type { FilterMode, TodoComputed, TodoDomain, TodoState } from "../types";

type TodoApp = ManifestoApp<TodoDomain, "base">;

type TodoActionName = ActionName<TodoDomain>;

export type ActionStatus = {
  readonly name: TodoActionName;
  readonly available: boolean;
  readonly parameters: readonly string[];
};

export type DraftInspection = {
  readonly title: string;
  readonly admission: Admission<"addTodo">;
  readonly preview: PreviewResult<TodoDomain, "addTodo">;
  readonly nextTodoCount: number | null;
  readonly changedPaths: readonly string[];
};

export type RuntimeEvent = {
  readonly id: number;
  readonly phase: "admitted" | "rejected" | "submitted" | "settled" | "failed";
  readonly action: string;
  readonly detail: string;
  readonly tone: "neutral" | "ok" | "warn" | "error";
};

type UseManifestoResult = {
  readonly state: TodoState | null;
  readonly computed: TodoComputed | null;
  readonly pendingAction: TodoActionName | null;
  readonly lastReport: BaseWriteReport | null;
  readonly lastError: string | null;
  readonly events: readonly RuntimeEvent[];
  readonly actionStatuses: readonly ActionStatus[];
  readonly inspectDraft: (title: string) => DraftInspection | null;
  readonly addTodo: (title: string) => Promise<void>;
  readonly toggleTodo: (id: string) => Promise<void>;
  readonly removeTodo: (id: string) => Promise<void>;
  readonly setFilter: (newFilter: FilterMode) => Promise<void>;
  readonly clearCompleted: () => Promise<void>;
};

const ACTION_NAMES = [
  "addTodo",
  "toggleTodo",
  "removeTodo",
  "setFilter",
  "clearCompleted",
] as const satisfies readonly TodoActionName[];

function formatPath(change: ChangedPath): string {
  return change.path.length > 0 ? change.path.join(".") : "state";
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parametersFor(app: TodoApp, name: TodoActionName): readonly string[] {
  return app.inspect.action(name).parameters.map((param) => {
    const type = param.type ?? "unknown";
    return `${param.name}${param.required ? "" : "?"}: ${type}`;
  });
}

function availableFor(app: TodoApp, name: TodoActionName): boolean {
  switch (name) {
    case "addTodo":
      return app.action.addTodo.available();
    case "toggleTodo":
      return app.action.toggleTodo.available();
    case "removeTodo":
      return app.action.removeTodo.available();
    case "setFilter":
      return app.action.setFilter.available();
    case "clearCompleted":
      return app.action.clearCompleted.available();
  }
}

export function useManifesto(): UseManifestoResult {
  const appRef = useRef<TodoApp | null>(null);
  const eventIdRef = useRef(0);
  const [todos, setTodos] = useState<TodoState["todos"] | null>(null);
  const [filterMode, setFilterMode] = useState<TodoState["filterMode"] | null>(null);
  const [todoCount, setTodoCount] = useState<TodoComputed["todoCount"] | null>(null);
  const [activeCount, setActiveCount] = useState<TodoComputed["activeCount"] | null>(null);
  const [completedCount, setCompletedCount] = useState<TodoComputed["completedCount"] | null>(null);
  const [hasCompleted, setHasCompleted] = useState<TodoComputed["hasCompleted"] | null>(null);
  const [pendingAction, setPendingAction] = useState<TodoActionName | null>(null);
  const [lastReport, setLastReport] = useState<BaseWriteReport | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [events, setEvents] = useState<readonly RuntimeEvent[]>([]);

  const pushEvent = useCallback((event: Omit<RuntimeEvent, "id">) => {
    eventIdRef.current += 1;
    const next = { ...event, id: eventIdRef.current };
    setEvents((current) => [next, ...current].slice(0, 8));
  }, []);

  useEffect(() => {
    const app = createManifesto<TodoDomain>(todoSchema, {}).activate();
    appRef.current = app;

    setTodos(app.state.todos.value());
    setFilterMode(app.state.filterMode.value());
    setTodoCount(app.computed.todoCount.value());
    setActiveCount(app.computed.activeCount.value());
    setCompletedCount(app.computed.completedCount.value());
    setHasCompleted(app.computed.hasCompleted.value());

    const stopTodos = app.state.todos.observe((value) => setTodos(value));
    const stopFilterMode = app.state.filterMode.observe((value) => setFilterMode(value));
    const stopTodoCount = app.computed.todoCount.observe((value) => setTodoCount(value));
    const stopActiveCount = app.computed.activeCount.observe((value) => setActiveCount(value));
    const stopCompletedCount = app.computed.completedCount.observe((value) => setCompletedCount(value));
    const stopHasCompleted = app.computed.hasCompleted.observe((value) => setHasCompleted(value));
    const stopAdmitted = app.observe.event("submission:admitted", (event) =>
      pushEvent({
        phase: "admitted",
        action: event.action,
        detail: event.intentId ?? "intent admitted",
        tone: "ok",
      }),
    );
    const stopRejected = app.observe.event("submission:rejected", (event) =>
      pushEvent({
        phase: "rejected",
        action: event.action,
        detail: event.admission.message,
        tone: "warn",
      }),
    );
    const stopSubmitted = app.observe.event("submission:submitted", (event) =>
      pushEvent({
        phase: "submitted",
        action: event.action,
        detail: event.intentId ?? "intent submitted",
        tone: "neutral",
      }),
    );
    const stopSettled = app.observe.event("submission:settled", (event) =>
      pushEvent({
        phase: "settled",
        action: event.action,
        detail: event.outcome.kind,
        tone: event.outcome.kind === "ok" ? "ok" : "warn",
      }),
    );
    const stopFailed = app.observe.event("submission:failed", (event) =>
      pushEvent({
        phase: "failed",
        action: event.action,
        detail: event.error.message,
        tone: "error",
      }),
    );

    return () => {
      stopTodos();
      stopFilterMode();
      stopTodoCount();
      stopActiveCount();
      stopCompletedCount();
      stopHasCompleted();
      stopAdmitted();
      stopRejected();
      stopSubmitted();
      stopSettled();
      stopFailed();
      appRef.current = null;
      app.dispose();
    };
  }, [pushEvent]);

  const state = todos !== null && filterMode !== null
    ? { todos, filterMode }
    : null;
  const computed = todoCount !== null
    && activeCount !== null
    && completedCount !== null
    && hasCompleted !== null
    ? { todoCount, activeCount, completedCount, hasCompleted }
    : null;

  const actionStatuses = state && computed && appRef.current
    ? ACTION_NAMES.map((name) => ({
        name,
        available: availableFor(appRef.current!, name),
        parameters: parametersFor(appRef.current!, name),
      }))
    : [];

  const inspectDraft = useCallback((title: string): DraftInspection | null => {
    const app = appRef.current;
    if (!app) {
      return null;
    }

    const titleInput = title;
    const action = app.with({ diagnostics: "summary" }).action.addTodo;
    const admission = action.check(titleInput);
    const preview = action.preview(titleInput);

    return {
      title: titleInput.trim(),
      admission,
      preview,
      nextTodoCount: preview.admitted ? preview.after.state.todos.length : null,
      changedPaths: preview.admitted ? preview.changes.map(formatPath) : [],
    };
  }, []);

  const submitOrRecord = useCallback(async <Name extends TodoActionName>(
    action: Name,
    run: (app: TodoApp) => Promise<SubmitResultFor<"base", TodoDomain, Name>>,
  ): Promise<void> => {
    const app = appRef.current;
    if (!app) {
      setLastError("Manifesto runtime is not available");
      return;
    }

    setPendingAction(action);
    setLastError(null);

    try {
      const result = await run(app.with({ report: "full" }));
      if (!result.ok) {
        setLastReport(null);
        setLastError(result.admission.message);
        return;
      }

      setLastReport(result.report ?? null);

      if (result.outcome.kind === "fail") {
        setLastError(result.outcome.error.message);
      } else if (result.outcome.kind === "stop") {
        setLastError(result.outcome.reason);
      }
    } catch (error) {
      setLastReport(null);
      setLastError(messageFromError(error));
    } finally {
      setPendingAction(null);
    }
  }, []);

  const addTodo = useCallback((title: string) =>
    submitOrRecord("addTodo", (app) => app.action.addTodo.submit(title)),
  [submitOrRecord]);

  const toggleTodo = useCallback((id: string) =>
    submitOrRecord("toggleTodo", (app) => app.action.toggleTodo.submit(id)),
  [submitOrRecord]);

  const removeTodo = useCallback((id: string) =>
    submitOrRecord("removeTodo", (app) => app.action.removeTodo.submit(id)),
  [submitOrRecord]);

  const setFilter = useCallback((newFilter: FilterMode) =>
    submitOrRecord("setFilter", (app) => app.action.setFilter.submit(newFilter)),
  [submitOrRecord]);

  const clearCompleted = useCallback(() =>
    submitOrRecord("clearCompleted", (app) => app.action.clearCompleted.submit()),
  [submitOrRecord]);

  return {
    state,
    computed,
    pendingAction,
    lastReport,
    lastError,
    events,
    actionStatuses,
    inspectDraft,
    addTodo,
    toggleTodo,
    removeTodo,
    setFilter,
    clearCompleted,
  };
}
