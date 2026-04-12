import type {
  ErrorInfo,
  PreparedGovernanceCommit,
} from "./types.js";
import type { PreparedLineageCommit } from "@manifesto-ai/lineage/provider";
import { createNoopGovernanceEventSink, type GovernanceEventDispatcher, type GovernanceEventSink, type GovernanceService } from "./types.js";
import { deriveErrorInfo } from "./error-info.js";

export interface CreateGovernanceEventDispatcherOptions {
  readonly service: Pick<
    GovernanceService,
    | "createExecutionCompletedEvent"
    | "createExecutionFailedEvent"
    | "createWorldCreatedEvent"
    | "createWorldForkedEvent"
  >;
  readonly sink?: GovernanceEventSink;
  readonly now?: () => number;
}

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
          deriveWorldCreatedFrom(governanceCommit, lineageCommit),
          outcome,
          timestamp
        )
      );

      if (isTrueForkCommit(lineageCommit)) {
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
          deriveExecutionFailure(lineageCommit),
          timestamp
        )
      );
    },
  };
}

function deriveWorldCreatedFrom(
  governanceCommit: PreparedGovernanceCommit,
  lineageCommit: PreparedLineageCommit
): string {
  if (lineageCommit.kind === "next") {
    return lineageCommit.edge.from;
  }

  return lineageCommit.world.parentWorldId ?? governanceCommit.proposal.baseWorld;
}

function deriveExecutionFailure(lineageCommit: PreparedLineageCommit): ErrorInfo {
  return deriveErrorInfo(lineageCommit.terminalSnapshot);
}

function isTrueForkCommit(
  lineageCommit: PreparedLineageCommit
): lineageCommit is Extract<PreparedLineageCommit, { kind: "next" }> & {
  readonly forkCreated: true;
} {
  return lineageCommit.kind === "next"
    && "forkCreated" in lineageCommit
    && lineageCommit.forkCreated === true;
}
