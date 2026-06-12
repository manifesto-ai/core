import type {
  CanonicalSnapshot,
  DispatchExecutionOutcome,
  ExecutionDiagnostics,
  ExecutionOutcome,
  ManifestoDomainShape,
  TypedIntent,
} from "@manifesto-ai/sdk";
import { ManifestoError } from "@manifesto-ai/sdk";

import {
  collectChangedStatePaths,
  findScopeViolations,
  toIntentScope,
} from "./governance-scope.js";
import type { GovernanceRuntimeDeps } from "./runtime-deps.js";
import { readSnapshotCurrentError } from "./snapshot-errors.js";
import type { Proposal, ProposalId } from "./types.js";

/**
 * Settlement/finalization seam: seals an approved execution into lineage and
 * compensates settlement failures with a terminal proposal record.
 */
export interface SettlementEngine<T extends ManifestoDomainShape> {
  finalizeApprovedExecution(
    executingProposal: Proposal & { readonly status: "executing" },
    intent: TypedIntent<T>,
  ): Promise<Proposal>;
  compensateSettlementFailure(
    proposalId: ProposalId,
    fallbackProposal: Proposal,
    resultWorld?: string,
  ): Promise<void>;
}

export function createSettlementEngine<T extends ManifestoDomainShape>(
  deps: GovernanceRuntimeDeps<T>,
): SettlementEngine<T> {
  const {
    kernel,
    lineage,
    governanceService,
    governanceStore,
    eventDispatcher,
    getCurrentTimestamp,
  } = deps;

  async function finalizeApprovedExecution(
    executingProposal: Proposal & { readonly status: "executing" },
    intent: TypedIntent<T>,
  ): Promise<Proposal> {
    let sealed: Awaited<ReturnType<typeof lineage.sealIntent>> | null = null;
    let terminalProposal: Proposal | null = null;
    let proposalPersisted = false;

    try {
      sealed = await lineage.sealIntent(intent, {
        branchId: executingProposal.branchId,
        baseWorldId: executingProposal.baseWorld,
        proposalRef: executingProposal.proposalId,
        decisionRef: executingProposal.decisionId,
        executionKey: executingProposal.executionKey,
        publishOnCompleted: false,
        assumeEnqueued: true,
        // A genuinely unsettled host result must never cross the governed
        // seal boundary (#478). "unless-failed" keeps the existing contract
        // that a failed effect execution seals as a failed world.
        rejectPendingBeforeSeal: "unless-failed",
        context: executingProposal.computeEnvelope.context,
      });
      if (
        sealed.preparedCommit.branchId !== executingProposal.branchId ||
        sealed.preparedCommit.attempt.baseWorldId !== executingProposal.baseWorld
      ) {
        throw new ManifestoError(
          "GOVERNANCE_LINEAGE_TARGET_MISMATCH",
          `Governance proposal "${executingProposal.proposalId}" sealed on a different lineage target`,
        );
      }

      // The authority approved a constrained scope; settlement must stay
      // inside it. Changed paths are diffed base-world -> terminal snapshot
      // and validated before the governance commit is finalized (#477).
      const approvedScope = toIntentScope(executingProposal.approvedScope);
      if (approvedScope?.allowedPaths && approvedScope.allowedPaths.length > 0) {
        const baseSnapshot = await lineage.getWorldSnapshot(
          executingProposal.baseWorld,
        );
        const changedPaths = collectChangedStatePaths(
          baseSnapshot?.state ?? {},
          (sealed.hostResult.snapshot as CanonicalSnapshot<T["state"]>).state,
        );
        const violations = findScopeViolations(changedPaths, approvedScope);
        if (violations.length > 0) {
          throw new ManifestoError(
            "GOVERNANCE_SCOPE_VIOLATION",
            `Governance proposal "${executingProposal.proposalId}" settled outside its approved scope: ${violations.join(", ")}`,
          );
        }
      }

      const governanceCommit = await governanceService.finalize(
        executingProposal,
        sealed.preparedCommit,
        getCurrentTimestamp(),
      );
      const terminalOutcome = toTerminalOutcome(
        sealed.hostResult.snapshot as CanonicalSnapshot<T["state"]>,
        Object.freeze({ hostTraces: sealed.hostResult.traces }) as ExecutionDiagnostics,
        intent,
      );
      terminalProposal = Object.freeze({
        ...governanceCommit.proposal,
        terminalOutcome,
      });
      const governanceCommitWithOutcome = Object.freeze({
        ...governanceCommit,
        proposal: terminalProposal,
      });

      await governanceStore.putProposal(terminalProposal);
      proposalPersisted = true;

      const activeBranch = await lineage.getActiveBranch();
      if (
        sealed.preparedCommit.branchChange.headAdvanced &&
        activeBranch.id === sealed.preparedCommit.branchId
      ) {
        kernel.setVisibleSnapshot(sealed.hostResult.snapshot);
      }

      eventDispatcher.emitSealCompleted(governanceCommitWithOutcome, sealed.preparedCommit);

      return terminalProposal;
    } catch (error) {
      const failure = toGovernanceFailure(error);
      if (!proposalPersisted) {
        try {
          if (terminalProposal) {
            try {
              await governanceStore.putProposal(terminalProposal);
            } catch {
              const failedProposal = governanceService.failExecution(
                executingProposal,
                getCurrentTimestamp(),
                sealed?.preparedCommit.worldId,
              );
              await governanceStore.putProposal(failedProposal);
            }
          } else {
            const failedProposal = governanceService.failExecution(
              executingProposal,
              getCurrentTimestamp(),
              sealed?.preparedCommit.worldId,
            );
            await governanceStore.putProposal(failedProposal);
          }
        } catch {
          // Preserve the original execution failure if compensating persistence also fails.
        }
      }
      throw failure;
    }
  }

  async function compensateSettlementFailure(
    proposalId: ProposalId,
    fallbackProposal: Proposal,
    resultWorld?: string,
  ): Promise<void> {
    const current = await governanceStore.getProposal(proposalId) ?? fallbackProposal;
    if (
      current.status === "completed"
      || current.status === "failed"
      || current.status === "rejected"
      || current.status === "superseded"
    ) {
      return;
    }

    await governanceStore.putProposal(
      await prepareCompensatingTerminalProposal(current, resultWorld),
    );
  }

  async function prepareCompensatingTerminalProposal(
    proposal: Proposal,
    resultWorld?: string,
  ): Promise<Proposal> {
    if (proposal.status === "approved") {
      const executing = governanceService.beginExecution(proposal);
      await governanceStore.putProposal(executing);
      return governanceService.failExecution(
        executing,
        getCurrentTimestamp(),
        resultWorld,
      );
    }

    if (proposal.status === "executing") {
      return governanceService.failExecution(
        proposal,
        getCurrentTimestamp(),
        resultWorld,
      );
    }

    return governanceService.prepareSupersede(proposal, "manual_cancel");
  }

  return {
    finalizeApprovedExecution,
    compensateSettlementFailure,
  };
}

export function toTypedComputeIntent<T extends ManifestoDomainShape>(proposal: Proposal): TypedIntent<T> {
  return {
    type: proposal.computeEnvelope.intent.type,
    intentId: proposal.computeEnvelope.intent.intentId,
    ...(proposal.computeEnvelope.intent.input !== undefined
      ? { input: proposal.computeEnvelope.intent.input }
      : {}),
  } as TypedIntent<T>;
}

function toGovernanceFailure(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new ManifestoError(
    "GOVERNANCE_EXECUTION_FAILED",
    "Governed proposal execution did not produce a completed result",
  );
}

export function toSettlementOutcome<T extends ManifestoDomainShape>(
  dispatchOutcome: DispatchExecutionOutcome<T>,
  proposal: Proposal,
): ExecutionOutcome {
  const after = dispatchOutcome.canonical.afterCanonicalSnapshot;
  const currentError = readSnapshotCurrentError(after);
  if (currentError) {
    return Object.freeze({
      kind: "fail",
      error: currentError,
    }) as ExecutionOutcome;
  }

  if (dispatchOutcome.canonical.status === "error") {
    return Object.freeze({
      kind: "fail",
      error: Object.freeze({
        code: "GOVERNANCE_EXECUTION_FAILED",
        message: "Governed proposal execution completed with error status",
        source: {
          actionId: proposal.intent.intentId,
          nodePath: "governance.waitForSettlement",
        },
        timestamp: after.meta.timestamp,
      }),
    }) as ExecutionOutcome;
  }

  return Object.freeze({ kind: "ok" }) as ExecutionOutcome;
}

function toTerminalOutcome<T extends ManifestoDomainShape>(
  terminalSnapshot: CanonicalSnapshot<T["state"]>,
  diagnostics: ExecutionDiagnostics,
  intent: TypedIntent<T>,
): ExecutionOutcome {
  const haltReason = findHaltReason(diagnostics);
  if (haltReason !== null) {
    return Object.freeze({
      kind: "stop",
      reason: haltReason,
    }) as ExecutionOutcome;
  }

  const currentError = readSnapshotCurrentError(terminalSnapshot);
  if (currentError) {
    return Object.freeze({
      kind: "fail",
      error: currentError,
    }) as ExecutionOutcome;
  }

  if (terminalSnapshot.system.status === "error") {
    return Object.freeze({
      kind: "fail",
      error: Object.freeze({
        code: "GOVERNANCE_EXECUTION_FAILED",
        message: "Governed proposal execution completed with error status",
        source: {
          actionId: intent.intentId,
          nodePath: "governance.finalizeExecution",
        },
        timestamp: terminalSnapshot.meta.timestamp,
      }),
    }) as ExecutionOutcome;
  }

  return Object.freeze({ kind: "ok" }) as ExecutionOutcome;
}

function findHaltReason(diagnostics: ExecutionDiagnostics): string | null {
  const haltTrace = diagnostics.hostTraces
    ?.slice()
    .reverse()
    .find((trace) => trace.terminatedBy === "halt");
  if (!haltTrace) {
    return null;
  }

  for (const node of Object.values(haltTrace.nodes)) {
    if (node.kind === "halt") {
      const reason = node.inputs.reason;
      return typeof reason === "string" ? reason : "halted";
    }
  }

  return "halted";
}
