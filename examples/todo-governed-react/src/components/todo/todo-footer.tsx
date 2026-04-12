import type { FilterMode } from "../../types";

type Props = {
  readonly activeCount: number;
  readonly hasCompleted: boolean;
  readonly filterMode: FilterMode;
  readonly onSetFilter: (filter: FilterMode) => void;
  readonly onClearCompleted: () => void;
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
    <footer className="flex items-center justify-between gap-3 px-4 py-3 text-sm flex-wrap">
      <span className="text-sage-400">
        <strong className="text-sage-600 font-medium">{activeCount}</strong>{" "}
        {activeCount === 1 ? "item" : "items"} left
      </span>

      <div className="flex gap-1">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            className={`
              px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all duration-150
              ${filterMode === filter
                ? "bg-sage-500/10 text-sage-500"
                : "text-sage-400 hover:text-sage-600 hover:bg-sage-900/[0.04]"
              }
            `}
            onClick={() => onSetFilter(filter)}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {hasCompleted && (
        <button
          className="px-2.5 py-1 rounded-md text-xs font-medium text-ember-500 hover:bg-ember-400/10 cursor-pointer transition-colors duration-150 relative"
          onClick={onClearCompleted}
        >
          <span className="absolute -top-0.5 left-0 w-1.5 h-1.5 rounded-full bg-ember-400" />
          Clear completed
        </button>
      )}
    </footer>
  );
}
