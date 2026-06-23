import { captionFor, useAgentDemo } from "./hooks/use-agent-demo";
import type { AgentLogEntry, Todo, TodoView, TodoWriteResponse } from "./types";

function TodoPanel({
  view,
  highlightTodoId,
}: {
  readonly view: TodoView;
  readonly highlightTodoId: string | null;
}) {
  return (
    <section className="panel todo-panel" aria-label="React Todo app">
      <div className="panel-header">
        <div>
          <p className="eyebrow">React Todo App</p>
          <h1>Shared app state</h1>
        </div>
        <span className="state-pill">{view.computed.activeCount} active</span>
      </div>

      <ul className="todo-list">
        {view.state.todos.map((todo) => (
          <TodoRow
            key={todo.id}
            todo={todo}
            highlighted={todo.id === highlightTodoId}
          />
        ))}
      </ul>
    </section>
  );
}

function TodoRow({
  todo,
  highlighted,
}: {
  readonly todo: Todo;
  readonly highlighted: boolean;
}) {
  return (
    <li className={`todo-row ${todo.completed ? "completed" : ""} ${highlighted ? "highlighted" : ""}`}>
      <span className="checkmark" aria-hidden="true">
        {todo.completed ? "✓" : ""}
      </span>
      <div>
        <strong>{todo.title}</strong>
        <small>{todo.completed ? "completed" : "active"}</small>
      </div>
    </li>
  );
}

function AgentPanel({
  log,
  status,
}: {
  readonly log: readonly AgentLogEntry[];
  readonly status: string;
}) {
  return (
    <section className="panel agent-panel" aria-label="Agent runtime panel">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Agent Runtime Panel</p>
          <h2>Clean up my todo list.</h2>
        </div>
        <span className={`state-pill ${status === "playing" ? "live" : ""}`}>
          {status}
        </span>
      </div>

      <ol className="agent-log">
        {log.length === 0 ? (
          <li className="placeholder">
            <span>waiting</span>
            <strong>Press play to run the scripted agent.</strong>
          </li>
        ) : log.map((entry) => (
          <li key={entry.id} className={`log-entry ${entry.tone}`}>
            <span>{entry.at}</span>
            <div>
              <strong>{entry.label}</strong>
              <code>{entry.detail}</code>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SnapshotPanel({
  view,
  lastResponse,
}: {
  readonly view: TodoView;
  readonly lastResponse: TodoWriteResponse | null;
}) {
  const changedPaths = lastResponse?.report?.changes.map((change) =>
    change.path.map((segment) => typeof segment === "number" ? `[${segment}]` : segment).join("."),
  ) ?? [];
  const available = view.availableActions.map((action) => action.name);

  return (
    <section className="snapshot-strip" aria-label="Snapshot and action log">
      <div className="snapshot-card">
        <span>snapshot.state.todos</span>
        <strong>{view.state.todos.length}</strong>
      </div>
      <div className="snapshot-card">
        <span>computed.activeCount</span>
        <strong>{view.computed.activeCount}</strong>
      </div>
      <div className="snapshot-card wide">
        <span>availableActions checked</span>
        <strong>{available.join(", ")}</strong>
      </div>
      <div className="snapshot-card wide">
        <span>latest changed paths</span>
        <strong>{changedPaths.length > 0 ? changedPaths.join(", ") : "none yet"}</strong>
      </div>
    </section>
  );
}

export function App() {
  const {
    view,
    caption,
    status,
    mode,
    log,
    lastResponse,
    highlightTodoId,
    play,
    reset,
  } = useAgentDemo();

  return (
    <main className={`demo-shell ${mode.capture ? "capture-mode" : ""} ${mode.frame === "final" ? "poster-mode" : ""}`}>
      <header className="hero-line">
        <div>
          <p className="eyebrow">Manifesto Agent Demo</p>
          <h1>Stop letting agents guess your app state.</h1>
        </div>
        <div className="controls" aria-label="Demo controls">
          <button type="button" onClick={() => void play()} disabled={status === "playing"}>
            {status === "playing" ? "Playing" : "Play"}
          </button>
          <button type="button" className="secondary" onClick={reset}>
            Reset
          </button>
        </div>
      </header>

      <p className="caption">{captionFor(caption)}</p>

      <section className="stage" aria-label="Manifesto web app and agent demo">
        <TodoPanel view={view} highlightTodoId={highlightTodoId} />
        <AgentPanel log={log} status={status} />
      </section>

      <SnapshotPanel view={view} lastResponse={lastResponse} />

      <footer className="demo-footer">
        <strong>Manifesto</strong>
        <span>Deterministic app state for AI agents.</span>
        <code>github.com/manifesto-ai/core</code>
      </footer>
    </main>
  );
}
