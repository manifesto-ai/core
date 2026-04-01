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

export type TodoComputed = {
  readonly todoCount: number;
  readonly completedCount: number;
  readonly activeCount: number;
  readonly hasCompleted: boolean;
};

export type TodoDomain = {
  readonly actions: {
    readonly addTodo: (title: string) => void;
    readonly toggleTodo: (id: string) => void;
    readonly removeTodo: (id: string) => void;
    readonly setFilter: (newFilter: FilterMode) => void;
    readonly clearCompleted: () => void;
  };
  readonly state: TodoData;
  readonly computed: TodoComputed;
};
