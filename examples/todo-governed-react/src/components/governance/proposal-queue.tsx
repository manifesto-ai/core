import { AnimatePresence, motion } from "motion/react";
import type { ReviewItem } from "../../types";
import { SettlementBadge } from "./settlement-badge";

type Props = {
  readonly reviewQueue: readonly ReviewItem[];
  readonly onApprove: (proposalId: string) => void;
  readonly onReject: (proposalId: string) => void;
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

export function ProposalQueue({ reviewQueue, onApprove, onReject }: Props) {
  return (
    <div className="bg-sand-200/88 border border-sage-900/[0.06] rounded-2xl shadow-[0_16px_48px_rgba(36,55,51,0.07)] backdrop-blur-lg p-5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[0.65rem] uppercase tracking-[0.16em] text-sage-400 font-medium">Reviewer</span>
        {reviewQueue.length > 0 && (
          <span className="text-[0.65rem] font-semibold text-ember-400 bg-ember-400/10 px-2 py-0.5 rounded-full">
            {reviewQueue.length}
          </span>
        )}
      </div>
      <h2 className="font-serif text-xl font-semibold text-sage-900 -tracking-[0.01em] mb-3">Review Inbox</h2>

      <p className="text-sage-400 text-[0.8rem] leading-relaxed mb-4">
        Destructive actions are held for approval. The writer sees a timeout until you decide.
      </p>

      <div className="grid gap-2.5">
        <AnimatePresence mode="popLayout">
          {reviewQueue.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-6 text-center text-sage-300 text-sm"
            >
              No proposals awaiting review
            </motion.div>
          ) : (
            reviewQueue.map(({ proposal, label, detail }) => (
              <motion.article
                key={proposal.proposalId}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, y: -10, transition: { duration: 0.2 } }}
                className="p-4 rounded-xl bg-sand-50 border border-sage-900/[0.05]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SettlementBadge kind="evaluating" />
                    <span className="text-[0.7rem] font-mono text-sage-300">
                      #{toShortId(proposal.proposalId)}
                    </span>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-sage-800 mt-2">{label}</h3>
                <p className="text-sage-400 text-[0.78rem] leading-relaxed mt-1">{detail}</p>

                <div className="flex items-center gap-2 mt-2 text-[0.7rem] text-sage-300">
                  <span>{formatTimestamp(proposal.submittedAt)}</span>
                  <span className="text-sage-200">&middot;</span>
                  <span>{proposal.actorId}</span>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-sage-600 text-sand-100 hover:bg-sage-500 cursor-pointer transition-colors shadow-sm"
                    onClick={() => onApprove(proposal.proposalId)}
                  >
                    Approve
                  </button>
                  <button
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-sage-900/[0.06] text-sage-600 hover:bg-sage-900/10 cursor-pointer transition-colors"
                    onClick={() => onReject(proposal.proposalId)}
                  >
                    Reject
                  </button>
                </div>
              </motion.article>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
