import { useEffect, useRef, useState } from "react";
import {
  createManifesto,
  type ManifestoBaseInstance,
  type Snapshot,
} from "@manifesto-ai/sdk";

import todoSchema from "../domain/todo.mel";
import type { FilterMode, TodoData, TodoDomain } from "../types";

type TodoSnapshot = Snapshot<TodoData>;

type UseManifestoResult = {
  readonly state: TodoSnapshot | null;
  readonly ready: boolean;
  readonly addTodo: (title: string) => Promise<TodoSnapshot>;
  readonly toggleTodo: (id: string) => Promise<TodoSnapshot>;
  readonly removeTodo: (id: string) => Promise<TodoSnapshot>;
  readonly setFilter: (newFilter: FilterMode) => Promise<TodoSnapshot>;
  readonly clearCompleted: () => Promise<TodoSnapshot>;
};

export function useManifesto(): UseManifestoResult {
  const worldRef = useRef<ManifestoBaseInstance<TodoDomain> | null>(null);
  const [state, setState] = useState<TodoSnapshot | null>(null);

  useEffect(() => {
    const world = createManifesto<TodoDomain>(todoSchema as string, {}).activate();
    worldRef.current = world;
    setState(world.getSnapshot());

    const unsubscribe = world.subscribe(
      (snapshot) => snapshot,
      (nextSnapshot) => setState(nextSnapshot),
    );

    return () => {
      unsubscribe();
      worldRef.current = null;
      setState(null);
      world.dispose();
    };
  }, []);

  const dispatchOrReject = (
    run: (world: ManifestoBaseInstance<TodoDomain>) => Promise<TodoSnapshot>,
  ): Promise<TodoSnapshot> => {
    const world = worldRef.current;
    if (!world) {
      return Promise.reject(new Error("Manifesto runtime is not ready"));
    }
    return run(world);
  };

  const addTodo = (title: string) =>
    dispatchOrReject((world) =>
      world.dispatchAsync(
        world.createIntent(world.MEL.actions.addTodo, title),
      ));

  const toggleTodo = (id: string) =>
    dispatchOrReject((world) =>
      world.dispatchAsync(
        world.createIntent(world.MEL.actions.toggleTodo, id),
      ));

  const removeTodo = (id: string) =>
    dispatchOrReject((world) =>
      world.dispatchAsync(
        world.createIntent(world.MEL.actions.removeTodo, id),
      ));

  const setFilter = (newFilter: FilterMode) =>
    dispatchOrReject((world) =>
      world.dispatchAsync(
        world.createIntent(world.MEL.actions.setFilter, newFilter),
      ));

  const clearCompleted = () =>
    dispatchOrReject((world) =>
      world.dispatchAsync(
        world.createIntent(world.MEL.actions.clearCompleted),
      ));

  return {
    state,
    ready: state !== null,
    addTodo,
    toggleTodo,
    removeTodo,
    setFilter,
    clearCompleted,
  };
}
