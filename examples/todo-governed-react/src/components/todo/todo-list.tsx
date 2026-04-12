import { AnimatePresence } from "motion/react";
import type { Todo } from "../../types";
import { TodoItem } from "./todo-item";

type Props = {
  readonly todos: readonly Todo[];
  readonly pendingDeletes: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
  readonly onRemove: (id: string) => void;
};

export function TodoList({ todos, pendingDeletes, onToggle, onRemove }: Props) {
  return (
    <ul className="list-none m-0 p-0">
      <AnimatePresence mode="popLayout">
        {todos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            isPendingDelete={pendingDeletes.has(todo.id)}
            onToggle={onToggle}
            onRemove={onRemove}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}
