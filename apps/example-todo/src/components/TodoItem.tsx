import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TodoItem as TodoItemType } from "@/domain/todo-domain";

interface TodoItemProps {
  todo: TodoItemType;
  isEditing: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onUpdateTitle: (title: string) => void;
  onStopEdit: () => void;
}

export function TodoItem({
  todo,
  isEditing,
  onToggle,
  onDelete,
  onStartEdit,
  onUpdateTitle,
  onStopEdit,
}: TodoItemProps) {
  const [editValue, setEditValue] = useState(todo.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed) {
      onUpdateTitle(trimmed);
    } else {
      onStopEdit();
      setEditValue(todo.title);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      setEditValue(todo.title);
      onStopEdit();
    }
  };

  const handleBlur = () => {
    if (isEditing) {
      handleSubmit();
    }
  };

  return (
    <li
      className={cn(
        "group flex items-center gap-3 py-3 px-4 border-b last:border-b-0 transition-colors",
        todo.completed && "bg-muted/30"
      )}
    >
      <Checkbox
        checked={todo.completed}
        onCheckedChange={onToggle}
        aria-label={`Mark "${todo.title}" as ${todo.completed ? "incomplete" : "complete"}`}
      />

      {isEditing ? (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="flex-1 h-8"
        />
      ) : (
        <span
          onDoubleClick={onStartEdit}
          className={cn(
            "flex-1 cursor-pointer select-none",
            todo.completed && "text-muted-foreground line-through"
          )}
        >
          {todo.title}
        </span>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
        aria-label={`Delete "${todo.title}"`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
