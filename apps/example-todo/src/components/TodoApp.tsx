import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { createManifestoApp } from "@manifesto-ai/react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TodoItem } from "@/components/TodoItem";
import { cn } from "@/lib/utils";
import {
  TodoDomain,
  initialState,
  type FilterType,
  type TodoItem as TodoItemType,
} from "@/domain/todo-domain";

// Create the Manifesto App - this handles all internal wiring
const Todo = createManifestoApp(TodoDomain, { initialState });

// Re-export Provider for App.tsx
export const TodoProvider = Todo.Provider;

function TodoAppContent() {
  const [inputValue, setInputValue] = useState("");

  // Access state with type-safe selectors
  const filter = Todo.useValue((s) => s.filter);
  const editingId = Todo.useValue((s) => s.editingId);

  // Access computed values
  const filteredTodos = Todo.useComputed((c) => c.filteredTodos) as TodoItemType[];
  const activeCount = Todo.useComputed((c) => c.activeCount) as number;
  const allCompleted = Todo.useComputed((c) => c.allCompleted) as boolean;
  const hasAnyTodos = Todo.useComputed((c) => c.hasAnyTodos) as boolean;
  const hasCompletedTodos = Todo.useComputed((c) => c.hasCompletedTodos) as boolean;

  // Get all actions
  const {
    add,
    toggle,
    remove,
    updateTitle,
    toggleAll,
    clearCompleted,
    setFilter,
    startEditing,
    stopEditing,
  } = Todo.useActions();

  // Helper to generate ID
  const generateId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Action handlers
  const handleAddTodo = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed) {
      add({
        id: generateId(),
        title: trimmed,
        createdAt: Date.now(),
      });
      setInputValue("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      handleAddTodo(e as unknown as FormEvent);
    }
  };

  const handleToggleTodo = (id: string) => {
    toggle({ id });
  };

  const handleDeleteTodo = (id: string) => {
    remove({ id });
  };

  const handleStartEdit = (id: string) => {
    startEditing({ id });
  };

  const handleUpdateTitle = (id: string, title: string) => {
    updateTitle({ id, title });
  };

  const handleStopEdit = () => {
    (stopEditing as () => Promise<void>)();
  };

  const handleToggleAll = () => {
    (toggleAll as () => Promise<void>)();
  };

  const handleClearCompleted = () => {
    (clearCompleted as () => Promise<void>)();
  };

  const handleSetFilter = (newFilter: FilterType) => {
    setFilter({ filter: newFilter });
  };

  return (
    <Card className="w-full max-w-lg mx-auto shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-center text-3xl font-light text-rose-400">
          todos
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-0 p-0">
        {/* Input Section */}
        <div className="flex items-center border-b px-4 py-2">
          {hasAnyTodos && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleAll}
              className={cn(
                "h-8 w-8 mr-2",
                allCompleted ? "text-foreground" : "text-muted-foreground/40"
              )}
              aria-label="Toggle all todos"
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          )}
          <form onSubmit={handleAddTodo} className="flex-1">
            <Input
              type="text"
              placeholder="What needs to be done?"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-lg placeholder:text-muted-foreground/50 placeholder:italic"
            />
          </form>
        </div>

        {/* Todo List */}
        {hasAnyTodos && (
          <ul className="divide-y">
            {filteredTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                isEditing={editingId === todo.id}
                onToggle={() => handleToggleTodo(todo.id)}
                onDelete={() => handleDeleteTodo(todo.id)}
                onStartEdit={() => handleStartEdit(todo.id)}
                onUpdateTitle={(title) => handleUpdateTitle(todo.id, title)}
                onStopEdit={handleStopEdit}
              />
            ))}
          </ul>
        )}
      </CardContent>

      {/* Footer */}
      {hasAnyTodos && (
        <CardFooter className="flex items-center justify-between text-sm text-muted-foreground border-t py-3 px-4">
          <span>
            {activeCount} {activeCount === 1 ? "item" : "items"} left
          </span>

          <div className="flex gap-1">
            {(["all", "active", "completed"] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "outline" : "ghost"}
                size="sm"
                onClick={() => handleSetFilter(f)}
                className={cn(
                  "h-7 px-2 capitalize",
                  filter === f && "border-muted-foreground/30"
                )}
              >
                {f}
              </Button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearCompleted}
            disabled={!hasCompletedTodos}
            className={cn(
              "h-7",
              !hasCompletedTodos && "invisible"
            )}
          >
            Clear completed
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

// Wrapper component that provides the context
export function TodoApp() {
  return (
    <Todo.Provider>
      <TodoAppContent />
    </Todo.Provider>
  );
}
