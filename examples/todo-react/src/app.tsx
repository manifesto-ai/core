import todoSchema from "./domain/todo.mel";
import { useManifesto } from "./hooks/use-manifesto";
import { TodoInput } from "./components/todo-input";
import { TodoList } from "./components/todo-list";
import { TodoFooter } from "./components/todo-footer";
import type { TodoData, Todo } from "./types";

export function App() {
  const { state, ready, act } = useManifesto(todoSchema);

  if (!ready || !state) {
    return <div className="loading">Loading...</div>;
  }

  const data = state.data as TodoData;
  const computed = state.computed as Record<string, unknown>;

  const todos = data.todos as Todo[];
  const filterMode = data.filterMode;
  const activeCount = computed["computed.activeCount"] as number;
  const hasCompleted = computed["computed.hasCompleted"] as boolean;

  const filteredTodos = todos.filter((todo) => {
    if (filterMode === "active") return !todo.completed;
    if (filterMode === "completed") return todo.completed;
    return true;
  });

  return (
    <section className="todoapp">
      <header className="header">
        <h1>todos</h1>
        <TodoInput onAdd={(title) => act("addTodo", { title })} />
      </header>

      {todos.length > 0 && (
        <>
          <section className="main">
            <TodoList
              todos={filteredTodos}
              onToggle={(id) => act("toggleTodo", { id })}
              onRemove={(id) => act("removeTodo", { id })}
            />
          </section>

          <TodoFooter
            activeCount={activeCount}
            hasCompleted={hasCompleted}
            filterMode={filterMode}
            onSetFilter={(f) => act("setFilter", { newFilter: f })}
            onClearCompleted={() => act("clearCompleted")}
          />
        </>
      )}

      <footer className="info">
        <p>
          Built with{" "}
          <a href="https://github.com/manifesto-ai/core">Manifesto</a> + React
        </p>
      </footer>
    </section>
  );
}
