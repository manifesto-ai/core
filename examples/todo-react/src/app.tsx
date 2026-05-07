import { useMemo, useState } from "react";
import { useManifesto } from "./hooks/use-manifesto";
import { TodoInput } from "./components/todo-input";
import { TodoList } from "./components/todo-list";
import { TodoFooter } from "./components/todo-footer";
import { RuntimePanel } from "./components/runtime-panel";

export function App() {
  const [draft, setDraft] = useState("");
  const {
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
  } = useManifesto();

  const draftInspection = inspectDraft(draft);
  const isPending = pendingAction !== null;

  const filteredTodos = useMemo(() => {
    if (!state) {
      return [];
    }

    const { todos, filterMode } = state;
    if (filterMode === "active") {
      return todos.filter((todo) => !todo.completed);
    }
    if (filterMode === "completed") {
      return todos.filter((todo) => todo.completed);
    }
    return todos;
  }, [state]);

  if (!state || !computed) {
    return <div className="loading">Loading runtime...</div>;
  }

  const { todos, filterMode } = state;
  const { activeCount, completedCount, hasCompleted, todoCount } = computed;
  const emptyLabel = todos.length === 0
    ? "No tasks"
    : `No ${filterMode} tasks`;

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Manifesto v5</p>
            <h1>Todo Runtime</h1>
          </div>
          <div className="runtime-state">
            <span>{pendingAction ?? "idle"}</span>
          </div>
        </header>

        <TodoInput
          draft={draft}
          inspection={draftInspection}
          disabled={isPending}
          onDraftChange={setDraft}
          onAdd={(title) => void addTodo(title)}
        />

        <section className="task-surface">
          <TodoList
            todos={filteredTodos}
            emptyLabel={emptyLabel}
            pending={isPending}
            onToggle={(id) => void toggleTodo(id)}
            onRemove={(id) => void removeTodo(id)}
          />
        </section>

        <TodoFooter
          totalCount={todoCount}
          activeCount={activeCount}
          completedCount={completedCount}
          hasCompleted={hasCompleted}
          filterMode={filterMode}
          pending={isPending}
          onSetFilter={(filter) => void setFilter(filter)}
          onClearCompleted={() => void clearCompleted()}
        />
      </section>

      <RuntimePanel
        state={state}
        computed={computed}
        draft={draft}
        draftInspection={draftInspection}
        actionStatuses={actionStatuses}
        lastReport={lastReport}
        lastError={lastError}
        events={events}
      />
    </main>
  );
}
