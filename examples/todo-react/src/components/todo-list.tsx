import type { Todo } from "../types";
import { TodoItem } from "./todo-item";

type Props = {
  todos: readonly Todo[];
  emptyLabel: string;
  pending: boolean;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
};

export function TodoList({ todos, emptyLabel, pending, onToggle, onRemove }: Props) {
  if (todos.length === 0) {
    return <div className="empty-state">{emptyLabel}</div>;
  }

  return (
    <ul className="todo-list">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          disabled={pending}
          onToggle={onToggle}
          onRemove={onRemove}
        />
      ))}
    </ul>
  );
}
