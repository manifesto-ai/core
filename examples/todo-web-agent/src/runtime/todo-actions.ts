import type { BaseWriteReport, SubmitResultFor } from "@manifesto-ai/sdk";

import { readTodoView } from "./manifesto-app";
import type { FilterMode, TodoApp, TodoDomain, TodoWriteResponse } from "../types";

type TodoActionName = keyof TodoDomain["actions"] & string;

type ActionResult<Name extends TodoActionName> =
  SubmitResultFor<"base", TodoDomain, Name>;

function toWriteResponse<Name extends TodoActionName>(
  app: TodoApp,
  action: Name,
  result: ActionResult<Name>,
): TodoWriteResponse {
  if (!result.ok) {
    return {
      status: "admission_blocked",
      action,
      admission: result.admission,
      report: null,
      view: readTodoView(app),
    };
  }

  const report: BaseWriteReport | null = result.report ?? null;

  if (result.outcome.kind === "ok") {
    return {
      status: "settled",
      action,
      outcome: result.outcome,
      report,
      view: readTodoView(app),
    };
  }

  if (result.outcome.kind === "stop") {
    return {
      status: "stop",
      action,
      outcome: result.outcome,
      report,
      view: readTodoView(app),
    };
  }

  return {
    status: "fail",
    action,
    outcome: result.outcome,
    report,
    view: readTodoView(app),
  };
}

export async function addTodo(app: TodoApp, title: string): Promise<TodoWriteResponse> {
  const result = await app.with({ report: "full" }).action.addTodo.submit(title);
  return toWriteResponse(app, "addTodo", result);
}

export async function toggleTodo(app: TodoApp, id: string): Promise<TodoWriteResponse> {
  const result = await app.with({ report: "full" }).action.toggleTodo.submit(id);
  return toWriteResponse(app, "toggleTodo", result);
}

export async function removeTodo(app: TodoApp, id: string): Promise<TodoWriteResponse> {
  const result = await app.with({ report: "full" }).action.removeTodo.submit(id);
  return toWriteResponse(app, "removeTodo", result);
}

export async function setFilter(app: TodoApp, filter: FilterMode): Promise<TodoWriteResponse> {
  const result = await app.with({ report: "full" }).action.setFilter.submit(filter);
  return toWriteResponse(app, "setFilter", result);
}

export async function clearCompleted(app: TodoApp): Promise<TodoWriteResponse> {
  const result = await app.with({ report: "full" }).action.clearCompleted.submit();
  return toWriteResponse(app, "clearCompleted", result);
}
