import type {
  GovernanceService,
  Proposal,
} from "@manifesto-ai/governance";
import type {
  LineageService,
  Snapshot,
} from "@manifesto-ai/lineage";
import { sealGovernedNext } from "./coordinator.js";
import type {
  ExecuteApprovedProposalInput,
  GovernedWorldStore,
  GovernanceEventDispatcher,
  ResumeExecutingProposalInput,
  RecoveredWorldRuntimeCompletion,
  SealedWorldRuntimeCompletion,
  WorldExecutionResult,
  WorldExecutionOptions,
  WorldExecutor,
  WorldRuntimeCompletion,
  WorldRuntime,
} from "./types.js";
import { isFacadeCasMismatchError } from "./internal/errors.js";

export interface DefaultWorldRuntimeOptions {
  readonly store: GovernedWorldStore;
  readonly lineage: LineageService;
  readonly governance: GovernanceService;
  readonly eventDispatcher: GovernanceEventDispatcher;
  readonly executor: WorldExecutor;
}

function isRecoveredProposal(
  proposal: Proposal | null | undefined
): proposal is Proposal & {
  readonly status: "completed" | "failed";
  readonly resultWorld: string;
} {
  return (
    proposal != null
    && (proposal.status === "completed" || proposal.status === "failed")
    && typeof proposal.resultWorld === "string"
  );
}

function isTerminalResumeSnapshot(snapshot: Snapshot): boolean {
  return (
    snapshot.system.status !== "pending"
    && snapshot.system.pendingRequirements.length === 0
  );
}

export class DefaultWorldRuntime implements WorldRuntime {
  public constructor(private readonly options: DefaultWorldRuntimeOptions) {}

  async executeApprovedProposal(
    input: ExecuteApprovedProposalInput
  ): Promise<WorldRuntimeCompletion> {
    const recovered = await this.tryRecoverCompletion(
      await this.options.store.getProposal(input.proposal.proposalId)
    );
    if (recovered) {
      return recovered;
    }

    const proposal = input.proposal;
    await this.assertProposalCurrent(proposal);
    if (proposal.status !== "executing") {
      throw new Error(
        `FACADE-RUNTIME-4 violation: executeApprovedProposal() requires executing proposal, received ${proposal.status}`
      );
    }

    const baseSnapshot = await this.options.lineage.getSnapshot(proposal.baseWorld);
    if (!baseSnapshot) {
      throw new Error(
        `FACADE-RUNTIME-1 violation: base snapshot ${proposal.baseWorld} was not found in lineage`
      );
    }

    const executionOptions: WorldExecutionOptions = {
      ...(proposal.approvedScope !== undefined
        ? { approvedScope: proposal.approvedScope }
        : {}),
      ...(input.executionOptions ?? {}),
    };
    const execution = await this.executeWithPolicy(
      proposal.executionKey,
      baseSnapshot,
      proposal.intent,
      executionOptions
    );

    return this.sealExecution(proposal, execution, input.completedAt);
  }

  async resumeExecutingProposal(
    input: ResumeExecutingProposalInput
  ): Promise<WorldRuntimeCompletion> {
    const recovered = await this.tryRecoverCompletion(
      await this.options.store.getProposal(input.proposal.proposalId)
    );
    if (recovered) {
      return recovered;
    }

    const proposal = input.proposal;
    await this.assertProposalCurrent(proposal);
    if (proposal.status !== "executing") {
      throw new Error(
        `FACADE-RUNTIME-4 violation: resumeExecutingProposal() requires executing proposal, received ${proposal.status}`
      );
    }

    const execution = isTerminalResumeSnapshot(input.resumeSnapshot)
      ? this.createExecutionFromSnapshot(input.resumeSnapshot)
      : await this.executeWithPolicy(
          proposal.executionKey,
          input.resumeSnapshot,
          proposal.intent,
          {
            ...(proposal.approvedScope !== undefined
              ? { approvedScope: proposal.approvedScope }
              : {}),
            ...(input.executionOptions ?? {}),
          }
        );

    return this.sealExecution(proposal, execution, input.completedAt);
  }

  private async assertProposalCurrent(proposal: Proposal): Promise<void> {
    if (proposal.status !== "executing") {
      return;
    }

    const storedProposal = await this.options.store.getProposal(proposal.proposalId);
    if (storedProposal && storedProposal.status !== "executing") {
      throw new Error(
        `FACADE-RUNTIME-11 violation: proposal ${proposal.proposalId} is no longer executing in store`
      );
    }

    let executionStageProposal: Proposal | null;
    try {
      executionStageProposal = await this.options.store.getExecutionStageProposal(
        proposal.branchId
      );
    } catch (error) {
      throw new Error(
        `FACADE-RUNTIME-11 violation: branch ${proposal.branchId} no longer has a unique execution-stage proposal`,
        { cause: error }
      );
    }

    if (
      executionStageProposal
      && executionStageProposal.proposalId !== proposal.proposalId
    ) {
      throw new Error(
        `FACADE-RUNTIME-11 violation: proposal ${proposal.proposalId} lost execution ownership for branch ${proposal.branchId}`
      );
    }

    const branch = await this.options.lineage.getBranch(proposal.branchId);
    if (!branch) {
      throw new Error(
        `FACADE-RUNTIME-11 violation: branch ${proposal.branchId} no longer exists`
      );
    }

    if (branch.head !== proposal.baseWorld || branch.epoch !== proposal.epoch) {
      throw new Error(
        `FACADE-RUNTIME-11 violation: proposal ${proposal.proposalId} is stale for branch ${proposal.branchId}`
      );
    }
  }

  private async tryRecoverCompletion(
    proposal: Proposal | null
  ): Promise<RecoveredWorldRuntimeCompletion | null> {
    if (!isRecoveredProposal(proposal)) {
      return null;
    }

    const recoveredSnapshot = await this.options.lineage.getSnapshot(
      proposal.resultWorld
    );
    if (!recoveredSnapshot) {
      throw new Error(
        `FACADE-RUNTIME-8 violation: recovered proposal ${proposal.proposalId} references missing result world ${proposal.resultWorld}`
      );
    }

    const execution = this.createExecutionFromSnapshot(recoveredSnapshot);
    if (proposal.status !== execution.outcome) {
      throw new Error(
        `FACADE-RUNTIME-8 violation: recovered proposal ${proposal.proposalId} has status ${proposal.status} but result world derives ${execution.outcome}`
      );
    }

    return {
      kind: "recovered",
      proposal,
      execution,
      resultWorld: proposal.resultWorld,
      terminalStatus: execution.outcome,
    };
  }

  private createExecutionFromSnapshot(
    terminalSnapshot: Snapshot
  ): WorldExecutionResult {
    return {
      outcome: this.options.governance.deriveOutcome(terminalSnapshot),
      terminalSnapshot,
      ...(terminalSnapshot.system.lastError != null
        ? { error: terminalSnapshot.system.lastError }
        : {}),
    };
  }

  private async executeWithPolicy(
    key: Proposal["executionKey"],
    baseSnapshot: Snapshot,
    intent: Proposal["intent"],
    opts?: WorldExecutionOptions
  ): Promise<WorldExecutionResult> {
    if (opts?.signal?.aborted) {
      this.options.executor.abort?.(key);
      throw new Error(
        `FACADE-RUNTIME-12 violation: execution ${key} was aborted before dispatch`
      );
    }

    const onAbort = () => {
      this.options.executor.abort?.(key);
    };
    opts?.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      return await this.options.executor.execute(key, baseSnapshot, intent, opts);
    } finally {
      opts?.signal?.removeEventListener("abort", onAbort);
    }
  }

  private async sealExecution(
    proposal: Proposal,
    execution: WorldExecutionResult,
    completedAt: number
  ): Promise<WorldRuntimeCompletion> {
    const derivedOutcome = this.options.governance.deriveOutcome(
      execution.terminalSnapshot
    );
    if (execution.outcome !== derivedOutcome) {
      throw new Error(
        `FACADE-RUNTIME-5 violation: executor outcome ${execution.outcome} disagrees with terminal snapshot outcome ${derivedOutcome}`
      );
    }

    try {
      const completed = await sealGovernedNext(this.options, {
        executingProposal: proposal,
        completedAt,
        sealInput: {
          schemaHash: execution.terminalSnapshot.meta.schemaHash,
          baseWorldId: proposal.baseWorld,
          branchId: proposal.branchId,
          terminalSnapshot: execution.terminalSnapshot,
          createdAt: completedAt,
          proposalRef: proposal.proposalId,
          decisionRef: proposal.decisionId,
          ...(execution.traceRef ? { traceRef: execution.traceRef } : {}),
        },
      });

      return {
        kind: "sealed",
        proposal: completed.governanceCommit.proposal,
        execution,
        resultWorld: completed.sealResult.worldId,
        terminalStatus: completed.sealResult.terminalStatus,
        lineageCommit: completed.lineageCommit,
        governanceCommit: completed.governanceCommit,
        sealResult: completed.sealResult,
      };
    } catch (error) {
      if (!isFacadeCasMismatchError(error)) {
        throw error;
      }

      const recovered = await this.tryRecoverCompletion(
        await this.options.store.getProposal(proposal.proposalId)
      );
      if (recovered) {
        return recovered;
      }

      await this.assertProposalCurrent(proposal);
      throw error;
    }
  }
}

export function createWorldRuntime(
  options: DefaultWorldRuntimeOptions
): WorldRuntime {
  return new DefaultWorldRuntime(options);
}
