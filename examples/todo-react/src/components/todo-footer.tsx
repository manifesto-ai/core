import type { FilterMode } from "../types";

type Props = {
  activeCount: number;
  hasCompleted: boolean;
  filterMode: FilterMode;
  onSetFilter: (filter: FilterMode) => void;
  onClearCompleted: () => void;
};

const FILTERS: FilterMode[] = ["all", "active", "completed"];

export function TodoFooter({
  activeCount,
  hasCompleted,
  filterMode,
  onSetFilter,
  onClearCompleted,
}: Props) {
  return (
    <footer className="footer">
      <span className="todo-count">
        <strong>{activeCount}</strong>{" "}
        {activeCount === 1 ? "item" : "items"} left
      </span>

      <ul className="filters">
        {FILTERS.map((f) => (
          <li key={f}>
            <a
              className={filterMode === f ? "selected" : ""}
              href={`#/${f}`}
              onClick={(e) => {
                e.preventDefault();
                onSetFilter(f);
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </a>
          </li>
        ))}
      </ul>

      {hasCompleted && (
        <button className="clear-completed" onClick={onClearCompleted}>
          Clear completed
        </button>
      )}
    </footer>
  );
}
