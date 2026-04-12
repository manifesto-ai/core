import { motion } from "motion/react";
import type { Todo } from "../../types";

type Props = {
  readonly todo: Todo;
  readonly isPendingDelete: boolean;
  readonly onToggle: (id: string) => void;
  readonly onRemove: (id: string) => void;
};

export function TodoItem({ todo, isPendingDelete, onToggle, onRemove }: Props) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: isPendingDelete ? 0.45 : 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="border-b border-sage-900/[0.06] last:border-b-0"
    >
      <div className="flex items-center gap-3 px-4 py-3 group">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(todo.id)}
          className={`
            w-5.5 h-5.5 rounded-full border flex-shrink-0 flex items-center justify-center transition-all duration-200 cursor-pointer
            ${todo.completed
              ? "bg-sage-500 border-sage-500"
              : "border-sage-900/20 hover:border-sage-500/50"
            }
          `}
        >
          {todo.completed && (
            <motion.svg
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              width="11" height="11" viewBox="0 0 14 14" fill="none"
            >
              <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </motion.svg>
          )}
        </button>

        {/* Label */}
        <span className={`flex-1 text-[0.92rem] leading-snug transition-all duration-200 ${
          todo.completed ? "text-sage-300 line-through" : "text-sage-800"
        }`}>
          {todo.title}
        </span>

        {/* Pending badge or delete button */}
        {isPendingDelete ? (
          <span className="text-[0.65rem] uppercase tracking-wider text-amber-600 bg-amber-400/15 px-2 py-0.5 rounded-full font-medium">
            Pending
          </span>
        ) : (
          <button
            onClick={() => onRemove(todo.id)}
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-ember-500 text-lg leading-none cursor-pointer transition-opacity duration-150 relative"
            title="Requires review"
          >
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-ember-400" />
            &times;
          </button>
        )}
      </div>
    </motion.li>
  );
}
