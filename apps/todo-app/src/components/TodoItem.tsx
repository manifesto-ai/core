import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Todo } from "../domain/effects";

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

export function TodoItem({ todo, onToggle, onRemove }: TodoItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
        todo.completed ? "bg-muted/50" : "bg-background hover:bg-muted/30"
      )}
    >
      <Checkbox
        checked={todo.completed}
        onCheckedChange={() => onToggle(todo.id)}
        className="h-5 w-5"
      />

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm transition-all",
            todo.completed && "line-through text-muted-foreground"
          )}
        >
          {todo.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(todo.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(todo.id)}
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
