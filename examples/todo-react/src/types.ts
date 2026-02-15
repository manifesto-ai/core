export type Todo = {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
};

export type FilterMode = "all" | "active" | "completed";

export type TodoData = {
  readonly todos: readonly Todo[];
  readonly filterMode: FilterMode;
};
