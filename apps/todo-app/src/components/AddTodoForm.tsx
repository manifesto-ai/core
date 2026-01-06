import { useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Plus } from "lucide-react";

interface AddTodoFormProps {
  onAdd: (title: string) => void;
  disabled?: boolean;
}

export function AddTodoForm({ onAdd, disabled }: AddTodoFormProps) {
  const [title, setTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    onAdd(trimmed);
    setTitle("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done?"
        disabled={disabled}
        className="flex-1"
      />
      <Button type="submit" disabled={disabled || !title.trim()}>
        <Plus className="h-4 w-4 mr-1" />
        Add
      </Button>
    </form>
  );
}
