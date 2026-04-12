import { useState, type FormEvent } from "react";

type Props = {
  onAdd: (title: string) => void;
};

export function TodoInput({ onAdd }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const title = value.trim();
    if (!title) return;
    onAdd(title);
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        className="w-full border-none outline-none px-4 py-3 rounded-xl bg-sage-900/[0.03] text-sage-800 text-[0.95rem] placeholder:text-sage-300 focus:bg-sage-900/[0.05] transition-colors"
        placeholder="What needs to be done?"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoFocus
      />
    </form>
  );
}
