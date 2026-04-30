import { useManifesto } from "./hooks/use-manifesto";
import { TodoInput } from "./components/todo-input";
import { TodoList } from "./components/todo-list";
import { TodoFooter } from "./components/todo-footer";

export function App() {
  const {
    snapshot,
    addTodo,
    toggleTodo,
    removeTodo,
    setFilter,
    clearCompleted,
  } = useManifesto();

  if (!snapshot) {
    return <div className="loading">Loading...</div>;
  }

  const { todos, filterMode } = snapshot.state;
  const { activeCount, hasCompleted } = snapshot.computed;

  const filteredTodos = todos.filter((todo) => {
    if (filterMode === "active") return !todo.completed;
    if (filterMode === "completed") return todo.completed;
    return true;
  });

  return (
    <section className="todoapp">
      <header className="header">
        <h1>todos</h1>
        <TodoInput onAdd={(title) => void addTodo(title)} />
      </header>

      {todos.length > 0 && (
        <>
          <section className="main">
            <TodoList
              todos={filteredTodos}
              onToggle={(id) => void toggleTodo(id)}
              onRemove={(id) => void removeTodo(id)}
            />
          </section>

          <TodoFooter
            activeCount={activeCount}
            hasCompleted={hasCompleted}
            filterMode={filterMode}
            onSetFilter={(filter) => void setFilter(filter)}
            onClearCompleted={() => void clearCompleted()}
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
