import { AnimatePresence, motion } from "motion/react";
import type { ActivityEntry } from "../../types";
import { SettlementBadge } from "./settlement-badge";

type Props = {
  readonly activity: readonly ActivityEntry[];
};

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function toShortId(value: string): string {
  return value.slice(-6);
}

export function ActivityFeed({ activity }: Props) {
  return (
    <div className="bg-sand-200/88 border border-sage-900/[0.06] rounded-2xl shadow-[0_16px_48px_rgba(36,55,51,0.07)] backdrop-blur-lg p-5">
      <div className="mb-1">
        <span className="text-[0.65rem] uppercase tracking-[0.16em] text-sage-400 font-medium">Activity</span>
      </div>
      <h2 className="font-serif text-xl font-semibold text-sage-900 -tracking-[0.01em] mb-4">Settlement Log</h2>

      <div className="grid gap-2">
        <AnimatePresence mode="popLayout">
          {activity.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-6 text-center text-sage-300 text-sm"
            >
              Settlements will appear here as actions are processed
            </motion.div>
          ) : (
            activity.map((entry, index) => (
              <motion.article
                key={entry.proposalId}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: index === 0 ? 1 : 0.7, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="p-3.5 rounded-xl bg-sand-50 border border-sage-900/[0.05]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SettlementBadge kind={entry.settlement} />
                    <span className="text-[0.7rem] font-mono text-sage-300">
                      #{toShortId(entry.proposalId)}
                    </span>
                  </div>
                  <span className="text-[0.65rem] text-sage-300">
                    {formatTimestamp(entry.observedAt)}
                  </span>
                </div>

                <h3 className="text-[0.82rem] font-medium text-sage-700 mt-1.5">{entry.label}</h3>
                <p className="text-sage-400 text-[0.72rem] leading-relaxed mt-0.5">{entry.detail}</p>

                <div className="flex items-center gap-2 mt-1.5 text-[0.65rem] text-sage-300">
                  <span className="capitalize">{entry.observedBy}</span>
                  {entry.resultWorld && (
                    <>
                      <span className="text-sage-200">&middot;</span>
                      <span className="font-mono">world ...{entry.resultWorld.slice(-8)}</span>
                    </>
                  )}
                </div>
              </motion.article>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
