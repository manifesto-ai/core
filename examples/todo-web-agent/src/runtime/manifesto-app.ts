import { createManifesto } from "@manifesto-ai/sdk";

import todoSchema from "../domain/todo.mel";
import type { TodoApp, TodoDomain, TodoView } from "../types";

export function createTodoRuntime(): TodoApp {
  return createManifesto<TodoDomain>(todoSchema, {}).activate();
}

export function readTodoView(app: TodoApp): TodoView {
  const snapshot = app.snapshot();

  return {
    state: snapshot.state,
    computed: snapshot.computed,
    availableActions: app.inspect.availableActions(),
  };
}
