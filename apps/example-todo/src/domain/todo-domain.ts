/**
 * Todo Domain - Using Manifesto Builder + createManifestoApp
 *
 * This domain uses defineDomain from @manifesto-ai/builder to define
 * state, computed values, and actions in a type-safe, declarative way.
 *
 * Note: Type assertions are used to work around Builder type system limitations.
 * The key pattern is using expr.get() to convert ItemProxy to Expr.
 */
import { z } from "zod";
import { defineDomain, type Expr, type DomainOutput, type FieldRef } from "@manifesto-ai/builder";

// ============ State Schema ============

export const TodoItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  createdAt: z.number(),
});

export type TodoItem = z.infer<typeof TodoItemSchema>;

export const TodoStateSchema = z.object({
  todos: z.array(TodoItemSchema),
  filter: z.enum(["all", "active", "completed"]),
  editingId: z.string().nullable(),
});

export type TodoState = z.infer<typeof TodoStateSchema>;
export type FilterType = "all" | "active" | "completed";

// ============ Domain Definition ============

export const TodoDomain = defineDomain(
  TodoStateSchema,
  ({ state, computed, actions, expr, flow }): DomainOutput => {
    // Helper to convert ItemProxy property to Expr (workaround for type system)
    const itemField = <T>(proxy: unknown): Expr<T> =>
      expr.get(proxy as unknown as FieldRef<T>);

    // ============ Computed Values ============

    // Active todos count
    const { activeCount } = computed.define({
      activeCount: expr.len(
        expr.filter(state.todos, (item) =>
          expr.not(itemField<boolean>(item.completed))
        )
      ),
    });

    // Completed todos count
    const { completedCount } = computed.define({
      completedCount: expr.len(
        expr.filter(state.todos, (item) =>
          itemField<boolean>(item.completed)
        )
      ),
    });

    // All todos completed
    const { allCompleted } = computed.define({
      allCompleted: expr.and(
        expr.gt(expr.len(state.todos), 0),
        expr.every(state.todos, (item) =>
          itemField<boolean>(item.completed)
        )
      ),
    });

    // Has any todos
    const { hasAnyTodos } = computed.define({
      hasAnyTodos: expr.gt(expr.len(state.todos), 0),
    });

    // Has completed todos
    const { hasCompletedTodos } = computed.define({
      hasCompletedTodos: expr.some(state.todos, (item) =>
        itemField<boolean>(item.completed)
      ),
    });

    // Filtered todos based on current filter
    const { filteredTodos } = computed.define({
      filteredTodos: expr.cond(
        expr.eq(state.filter, "active"),
        expr.filter(state.todos, (item) =>
          expr.not(itemField<boolean>(item.completed))
        ),
        expr.cond(
          expr.eq(state.filter, "completed"),
          expr.filter(state.todos, (item) =>
            itemField<boolean>(item.completed)
          ),
          state.todos
        )
      ),
    });

    // ============ Actions ============

    // Add a new todo (id and createdAt provided by caller)
    const { add } = actions.define({
      add: {
        input: z.object({
          id: z.string(),
          title: z.string(),
          createdAt: z.number(),
        }),
        flow: flow.patch(state.todos).set(
          expr.append(state.todos, expr.object<TodoItem>({
            id: expr.input<string>("id"),
            title: expr.input<string>("title"),
            completed: expr.lit(false),
            createdAt: expr.input<number>("createdAt"),
          }))
        ),
      },
    });

    // Toggle a todo's completed status
    const { toggle } = actions.define({
      toggle: {
        input: z.object({ id: z.string() }),
        flow: flow.patch(state.todos).set(
          expr.map(state.todos, (item) =>
            expr.cond(
              expr.eq(itemField<string>(item.id), expr.input<string>("id")),
              expr.merge<TodoItem>(
                itemField<TodoItem>(item),
                expr.object({ completed: expr.not(itemField<boolean>(item.completed)) })
              ),
              itemField<TodoItem>(item)
            )
          )
        ),
      },
    });

    // Delete a todo
    const { remove } = actions.define({
      remove: {
        input: z.object({ id: z.string() }),
        flow: flow.patch(state.todos).set(
          expr.filter(state.todos, (item) =>
            expr.neq(itemField<string>(item.id), expr.input<string>("id"))
          )
        ),
      },
    });

    // Update a todo's title
    const { updateTitle } = actions.define({
      updateTitle: {
        input: z.object({ id: z.string(), title: z.string() }),
        flow: flow.seq(
          flow.patch(state.todos).set(
            expr.map(state.todos, (item) =>
              expr.cond(
                expr.eq(itemField<string>(item.id), expr.input<string>("id")),
                expr.merge<TodoItem>(
                  itemField<TodoItem>(item),
                  expr.object({ title: expr.input<string>("title") })
                ),
                itemField<TodoItem>(item)
              )
            )
          ),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (flow.patch(state.editingId) as any).set(expr.lit(null))
        ),
      },
    });

    // Toggle all todos
    const { toggleAll } = actions.define({
      toggleAll: {
        flow: flow.when(
          expr.every(state.todos, (item) =>
            itemField<boolean>(item.completed)
          ),
          // All completed -> mark all as not completed
          flow.patch(state.todos).set(
            expr.map(state.todos, (item) =>
              expr.merge<TodoItem>(
                itemField<TodoItem>(item),
                expr.object({ completed: expr.lit(false) })
              )
            )
          ),
          // Not all completed -> mark all as completed
          flow.patch(state.todos).set(
            expr.map(state.todos, (item) =>
              expr.merge<TodoItem>(
                itemField<TodoItem>(item),
                expr.object({ completed: expr.lit(true) })
              )
            )
          )
        ),
      },
    });

    // Clear completed todos
    const { clearCompleted } = actions.define({
      clearCompleted: {
        flow: flow.patch(state.todos).set(
          expr.filter(state.todos, (item) =>
            expr.not(itemField<boolean>(item.completed))
          )
        ),
      },
    });

    // Set filter
    const { setFilter } = actions.define({
      setFilter: {
        input: z.object({ filter: z.enum(["all", "active", "completed"]) }),
        flow: flow.patch(state.filter).set(expr.input<FilterType>("filter")),
      },
    });

    // Start editing
    const { startEditing } = actions.define({
      startEditing: {
        input: z.object({ id: z.string() }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        flow: (flow.patch(state.editingId) as any).set(expr.input<string>("id")),
      },
    });

    // Stop editing
    const { stopEditing } = actions.define({
      stopEditing: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        flow: (flow.patch(state.editingId) as any).set(expr.lit(null)),
      },
    });

    return {
      computed: {
        activeCount,
        completedCount,
        allCompleted,
        hasAnyTodos,
        hasCompletedTodos,
        filteredTodos,
      },
      actions: {
        add,
        toggle,
        remove,
        updateTitle,
        toggleAll,
        clearCompleted,
        setFilter,
        startEditing,
        stopEditing,
      } as DomainOutput["actions"],
    };
  },
  { id: "todo-domain", version: "1.0.0" }
);

// ============ Initial State ============

export const initialState: TodoState = {
  todos: [],
  filter: "all",
  editingId: null,
};
