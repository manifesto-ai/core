import { useEffect, useState, useCallback, useMemo } from "react";
import { createApp } from "@manifesto-ai/app";
import type { AppState } from "@manifesto-ai/app";
import { compileMelDomain } from "@manifesto-ai/compiler";
import type { DomainSchema } from "@manifesto-ai/core";
import TodoMel from "../domain/todo.mel";
import { todoEffects, type Todo } from "../domain/effects";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { TodoItem } from "./TodoItem";
import { AddTodoForm } from "./AddTodoForm";
import { FilterTabs } from "./FilterTabs";
import { TodoStats } from "./TodoStats";
import { Badge } from "./ui/badge";

// =============================================================================
// Types
// =============================================================================

export type FilterType = "all" | "active" | "completed";

export interface TodoData {
  todos: Todo[];
  filter: FilterType;
  status: "idle" | "loading" | "error";
  lastError: string | null;
}

// =============================================================================
// Schema Compilation
// =============================================================================

function compileTodoSchema(): DomainSchema {
  const result = compileMelDomain(TodoMel, { mode: "domain" });
  if (result.errors.length > 0) {
    throw new Error(`MEL compilation failed: ${result.errors.map(e => e.message).join(", ")}`);
  }
  if (!result.schema) {
    throw new Error("MEL compilation produced no schema");
  }
  return result.schema as DomainSchema;
}

const todoSchema = compileTodoSchema();

// =============================================================================
// App Instance (v2.3.0 Effects-first API)
// =============================================================================

const todoApp = createApp({
  schema: todoSchema,
  effects: todoEffects,
});

export { todoApp };

// =============================================================================
// Component
// =============================================================================

export function TodoApp() {
  const [state, setState] = useState<AppState<TodoData> | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      await todoApp.ready();
      setIsReady(true);
      setState(todoApp.getState<TodoData>());

      unsubscribe = todoApp.subscribe(
        (s) => s,
        (s) => setState(s as AppState<TodoData>),
        { batchMode: "immediate" }
      );

      await todoApp.act("loadTodos", {}).done();
    };

    init().catch(console.error);
    return () => unsubscribe?.();
  }, []);

  // Action handlers
  const handleAddTodo = useCallback(
    (title: string) => todoApp.act("addTodo", { title }).done(),
    []
  );

  const handleToggleTodo = useCallback(
    (id: string) => todoApp.act("toggleTodo", { id }).done(),
    []
  );

  const handleRemoveTodo = useCallback(
    (id: string) => todoApp.act("removeTodo", { id }).done(),
    []
  );

  const handleSetFilter = useCallback(
    (filter: FilterType) => todoApp.act("setFilter", { newFilter: filter }).done(),
    []
  );

  // Derived state
  const { todos, filter, status, filteredTodos, activeCount, completedCount } = useMemo(() => {
    if (!state) {
      return {
        todos: [] as Todo[],
        filter: "all" as FilterType,
        status: "idle" as const,
        filteredTodos: [] as Todo[],
        activeCount: 0,
        completedCount: 0,
      };
    }

    const todos = state.data.todos ?? [];
    const filter = state.data.filter ?? "all";
    const status = state.data.status ?? "idle";

    const filteredTodos = todos.filter((todo) => {
      if (filter === "active") return !todo.completed;
      if (filter === "completed") return todo.completed;
      return true;
    });

    return {
      todos,
      filter,
      status,
      filteredTodos,
      activeCount: todos.filter((t) => !t.completed).length,
      completedCount: todos.filter((t) => t.completed).length,
    };
  }, [state]);

  // Loading state
  if (!isReady || !state) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const emptyMessage =
    filter === "all"
      ? "No todos yet. Add one above!"
      : filter === "active"
        ? "No active todos."
        : "No completed todos.";

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Manifesto Todo</CardTitle>
            <CardDescription>Powered by MEL + @manifesto-ai/app</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {status === "loading" && <Badge variant="secondary">Loading...</Badge>}
            <Badge variant="outline">v{state.meta.version}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <AddTodoForm onAdd={handleAddTodo} disabled={status === "loading"} />

        <FilterTabs
          filter={filter}
          onFilterChange={handleSetFilter}
          counts={{ all: todos.length, active: activeCount, completed: completedCount }}
        />

        <div className="space-y-2">
          {filteredTodos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>
          ) : (
            filteredTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={handleToggleTodo}
                onRemove={handleRemoveTodo}
              />
            ))
          )}
        </div>

        {todos.length > 0 && (
          <TodoStats
            total={state.computed.totalCount as number}
            active={activeCount}
            completed={completedCount}
          />
        )}
      </CardContent>
    </Card>
  );
}
