import type { PreparedGovernanceCommit, PreparedLineageCommit, SealRejectionReason } from "./types.js";
import { createNoopGovernanceEventSink, type GovernanceEventDispatcher, type GovernanceEventSink, type GovernanceService } from "./types.js";

export interface CreateGovernanceEventDispatcherOptions {
  readonly service: Pick<
    GovernanceService,
    | "createExecutionCompletedEvent"
    | "createExecutionFailedEvent"
    | "createExecutionSealRejectedEvent"
    | "createWorldCreatedEvent"
    | "createWorldForkedEvent"
  >;
  readonly sink?: GovernanceEventSink;
  readonly now?: () => number;
}

const DEFAULT_EXECUTION_FAILURE = {
  summary: "Execution failed",
} as const;

export function createGovernanceEventDispatcher(
  options: CreateGovernanceEventDispatcherOptions
): GovernanceEventDispatcher {
  const sink = options.sink ?? createNoopGovernanceEventSink();
  const now = options.now ?? Date.now;

  return {
    emitSealCompleted(
      governanceCommit: PreparedGovernanceCommit,
      lineageCommit: PreparedLineageCommit
    ): void {
      const timestamp = now();
      const outcome =
        governanceCommit.proposal.status === "completed" ? "completed" : "failed";

      sink.emit(
        options.service.createWorldCreatedEvent(
          lineageCommit.world,
          governanceCommit.proposal.proposalId,
          governanceCommit.proposal.baseWorld,
          outcome,
          timestamp
        )
      );

      if (lineageCommit.kind === "next") {
        sink.emit(
          options.service.createWorldForkedEvent(
            governanceCommit.proposal.branchId,
            lineageCommit.edge.from,
            timestamp
          )
        );
      }

      if (outcome === "completed") {
        sink.emit(options.service.createExecutionCompletedEvent(governanceCommit.proposal, timestamp));
        return;
      }

      sink.emit(
        options.service.createExecutionFailedEvent(
          governanceCommit.proposal,
          DEFAULT_EXECUTION_FAILURE,
          timestamp
        )
      );
    },

    emitSealRejected(
      governanceCommit: PreparedGovernanceCommit,
      rejection: SealRejectionReason
    ): void {
      const timestamp = now();
      sink.emit(
        options.service.createExecutionSealRejectedEvent(
          governanceCommit.proposal,
          rejection,
          timestamp
        )
      );
    },
  };
}
