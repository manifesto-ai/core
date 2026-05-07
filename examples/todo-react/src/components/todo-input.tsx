import { useState, type FormEvent } from "react";
import type { DraftInspection } from "../hooks/use-manifesto";

type Props = {
  draft: string;
  inspection: DraftInspection | null;
  disabled: boolean;
  onDraftChange: (title: string) => void;
  onAdd: (title: string) => void;
};

export function TodoInput({
  draft,
  inspection,
  disabled,
  onDraftChange,
  onAdd,
}: Props) {
  const [isFocused, setIsFocused] = useState(false);
  const canSubmit = Boolean(inspection?.admission.ok) && !disabled;
  const previewCount = inspection?.nextTodoCount;
  const status = inspection
    ? inspection.admission.ok
      ? `Preview: ${previewCount ?? "-"} total`
      : inspection.admission.message
    : "Runtime warming up";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      onAdd(draft);
      onDraftChange("");
    }
  };

  return (
    <form className="task-entry" onSubmit={handleSubmit}>
      <div className={`entry-box ${isFocused ? "focused" : ""}`}>
        <input
          className="new-todo"
          placeholder="Add a task"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoFocus
        />
        <button className="add-button" type="submit" disabled={!canSubmit}>
          Add
        </button>
      </div>
      <div className={inspection?.admission.ok ? "entry-status ok" : "entry-status"}>
        {status}
      </div>
    </form>
  );
}
