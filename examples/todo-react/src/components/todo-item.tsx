import type { Todo } from "../types";

type Props = {
  todo: Todo;
  disabled: boolean;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
};

export function TodoItem({ todo, disabled, onToggle, onRemove }: Props) {
  return (
    <li className={todo.completed ? "completed" : ""}>
      <div className="view">
        <input
          className="toggle"
          type="checkbox"
          checked={todo.completed}
          disabled={disabled}
          onChange={() => onToggle(todo.id)}
        />
        <label>
          <span>{todo.title}</span>
          <small>{todo.id.slice(0, 8)}</small>
        </label>
        <button
          className="destroy"
          type="button"
          disabled={disabled}
          aria-label={`Remove ${todo.title}`}
          onClick={() => onRemove(todo.id)}
        >
          Remove
        </button>
      </div>
    </li>
  );
}
