import type {
  ErrorInfo,
  PreparedGovernanceCommit,
  PreparedLineageCommit,
} from "./types.js";
import { createNoopGovernanceEventSink, type GovernanceEventDispatcher, type GovernanceEventSink, type GovernanceService } from "./types.js";

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
          governanceCommit.proposal.baseWorld,
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

function deriveExecutionFailure(lineageCommit: PreparedLineageCommit): ErrorInfo {
  const currentError = lineageCommit.terminalSnapshot.system.lastError ?? undefined;
  const pendingRequirements = lineageCommit.terminalSnapshot.system.pendingRequirements.map(
    (requirement) => requirement.id
  );

  return {
    summary: summarizeFailure(currentError ? 1 : 0, pendingRequirements.length),
    ...(currentError ? { currentError } : {}),
    ...(pendingRequirements.length > 0 ? { pendingRequirements } : {}),
  };
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

function summarizeFailure(errorCount: number, pendingRequirementCount: number): string {
  if (errorCount > 0 && pendingRequirementCount > 0) {
    return `Execution failed with ${errorCount} error(s) and ${pendingRequirementCount} pending requirement(s)`;
  }
  if (errorCount > 0) {
    return `Execution failed with ${errorCount} error(s)`;
  }
  if (pendingRequirementCount > 0) {
    return `Execution failed with ${pendingRequirementCount} pending requirement(s)`;
  }
  return "Execution failed";
}
