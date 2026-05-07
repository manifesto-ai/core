import type { FilterMode } from "../types";

type Props = {
  totalCount: number;
  activeCount: number;
  completedCount: number;
  hasCompleted: boolean;
  filterMode: FilterMode;
  pending: boolean;
  onSetFilter: (filter: FilterMode) => void;
  onClearCompleted: () => void;
};

const FILTERS: FilterMode[] = ["all", "active", "completed"];

export function TodoFooter({
  totalCount,
  activeCount,
  completedCount,
  hasCompleted,
  filterMode,
  pending,
  onSetFilter,
  onClearCompleted,
}: Props) {
  return (
    <footer className="footer">
      <div className="todo-count">
        <strong>{activeCount}</strong>
        <span>{activeCount === 1 ? "active item" : "active items"}</span>
        <small>{totalCount} total / {completedCount} done</small>
      </div>

      <div className="filters" role="tablist" aria-label="Task filter">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={filterMode === f ? "selected" : ""}
            disabled={pending || filterMode === f}
            onClick={() => onSetFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {hasCompleted && (
        <button
          className="clear-completed"
          type="button"
          disabled={pending}
          onClick={onClearCompleted}
        >
          Clear completed
        </button>
      )}
    </footer>
  );
}
