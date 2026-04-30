import { useEffect, useRef, useState } from "react";
import {
  createManifesto,
  type ActionName,
  type ManifestoApp,
  type ProjectedSnapshot,
  type SubmitResultFor,
} from "@manifesto-ai/sdk";

import todoSchema from "../domain/todo.mel";
import type { FilterMode, TodoDomain } from "../types";

type TodoApp = ManifestoApp<TodoDomain, "base">;
type TodoSnapshot = Omit<ProjectedSnapshot<TodoDomain>, "computed"> & {
  readonly computed: TodoDomain["computed"];
};

type UseManifestoResult = {
  readonly snapshot: TodoSnapshot | null;
  readonly addTodo: (title: string) => Promise<TodoSnapshot>;
  readonly toggleTodo: (id: string) => Promise<TodoSnapshot>;
  readonly removeTodo: (id: string) => Promise<TodoSnapshot>;
  readonly setFilter: (newFilter: FilterMode) => Promise<TodoSnapshot>;
  readonly clearCompleted: () => Promise<TodoSnapshot>;
};

function toTodoSnapshot(snapshot: ProjectedSnapshot<TodoDomain>): TodoSnapshot {
  return snapshot as TodoSnapshot;
}

export function useManifesto(): UseManifestoResult {
  const appRef = useRef<TodoApp | null>(null);
  const [snapshot, setSnapshot] = useState<TodoSnapshot | null>(null);

  useEffect(() => {
    const app = createManifesto<TodoDomain>(todoSchema, {}).activate();
    appRef.current = app;
    setSnapshot(toTodoSnapshot(app.snapshot()));

    const stopObserving = app.observe.state(
      (snapshot) => snapshot,
      (nextSnapshot) => setSnapshot(toTodoSnapshot(nextSnapshot)),
    );

    return () => {
      stopObserving();
      appRef.current = null;
      setSnapshot(null);
      app.dispose();
    };
  }, []);

  const submitOrReject = async <Name extends ActionName<TodoDomain>>(
    run: (app: TodoApp) => Promise<SubmitResultFor<"base", TodoDomain, Name>>,
  ): Promise<TodoSnapshot> => {
    const app = appRef.current;
    if (!app) {
      throw new Error("Manifesto runtime is not available");
    }

    const result = await run(app);
    if (!result.ok) {
      throw new Error(result.admission.message);
    }

    return toTodoSnapshot(result.after);
  };

  const addTodo = (title: string) =>
    submitOrReject((app) => app.actions.addTodo.submit(title));

  const toggleTodo = (id: string) =>
    submitOrReject((app) => app.actions.toggleTodo.submit(id, {
      __kind: "SubmitOptions",
      report: "summary"
    }));

  const removeTodo = (id: string) =>
    submitOrReject((app) => app.actions.removeTodo.submit(id));

  const setFilter = (newFilter: FilterMode) =>
    submitOrReject((app) => app.actions.setFilter.submit(newFilter));

  const clearCompleted = () =>
    submitOrReject((app) => app.actions.clearCompleted.submit());

  return {
    snapshot,
    addTodo,
    toggleTodo,
    removeTodo,
    setFilter,
    clearCompleted,
  };
}
