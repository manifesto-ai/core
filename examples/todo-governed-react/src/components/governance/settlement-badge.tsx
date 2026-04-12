import { motion } from "motion/react";

type SettlementKind = "evaluating" | "completed" | "failed" | "rejected" | "superseded" | "pending" | "timed_out";

type Props = {
  readonly kind: SettlementKind;
};

const BADGE_STYLES: Record<SettlementKind, string> = {
  evaluating: "bg-amber-400/15 text-amber-600",
  pending: "bg-amber-400/15 text-amber-600",
  completed: "bg-sage-500/12 text-sage-500",
  rejected: "bg-red-100 text-red-600",
  failed: "bg-red-100 text-red-600",
  timed_out: "bg-sage-900/[0.06] text-sage-400",
  superseded: "bg-sage-900/[0.06] text-sage-400",
};

const LABELS: Record<SettlementKind, string> = {
  evaluating: "Evaluating",
  pending: "Pending",
  completed: "Approved",
  rejected: "Rejected",
  failed: "Failed",
  timed_out: "Timed out",
  superseded: "Superseded",
};

export function SettlementBadge({ kind }: Props) {
  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full
        text-[0.6rem] uppercase tracking-[0.08em] font-semibold
        ${BADGE_STYLES[kind]}
      `}
    >
      {(kind === "evaluating" || kind === "pending") && (
        <span className="w-1 h-1 rounded-full bg-current animate-pulse-dot" />
      )}
      {LABELS[kind]}
    </motion.span>
  );
}
