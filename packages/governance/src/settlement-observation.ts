import type {
  ErrorValue,
} from "@manifesto-ai/core";
import type {
  ActionName,
  ExecutionOutcome,
  GovernanceSettlementResult,
  ManifestoDomainShape,
  ProposalRef,
  SubmitReportMode,
  WorldRecord,
} from "@manifesto-ai/sdk";
import {
  DisposedError,
  ManifestoError,
} from "@manifesto-ai/sdk";

import type { SettlementRecovery } from "./recovery.js";
import type { GovernanceRuntimeDeps } from "./runtime-deps.js";
import { toSettlementOutcome } from "./settlement.js";
import { readSnapshotCurrentError } from "./snapshot-errors.js";
import type {
  DecisionRecord,
  Proposal,
  ProposalId,
} from "./types.js";

/**
 * Settlement observation seam: waits for a proposal to reach a terminal
 * state and projects it into a `GovernanceSettlementResult`.
 */
export interface SettlementObservation<T extends ManifestoDomainShape> {
  waitForSettlement<Name extends ActionName<T>>(
    proposalRef: ProposalRef,
    actionName?: Name,
    reportMode?: SubmitReportMode,
  ): Promise<GovernanceSettlementResult<T, Name>>;
}

export function createSettlementObservation<T extends ManifestoDomainShape>(
  deps: GovernanceRuntimeDeps<T>,
  recovery: Pick<SettlementRecovery, "resumeStoredSettlement">,
): SettlementObservation<T> {
  const {
    kernel,
    lineage,
    governanceStore,
  } = deps;
  const { resumeStoredSettlement } = recovery;

  async function waitForSettlement<Name extends ActionName<T>>(
    proposalRef: ProposalRef,
    actionName?: Name,
    reportMode?: SubmitReportMode,
  ): Promise<GovernanceSettlementResult<T, Name>> {
    const resumeAttempts = new Set<ProposalId>();
    while (true) {
      if (kernel.isDisposed()) {
        throw new DisposedError();
      }

      const proposal = await governanceStore.getProposal(proposalRef);
      if (!proposal) {
        throw new ManifestoError(
          "GOVERNANCE_PROPOSAL_NOT_FOUND",
          `Proposal "${proposalRef}" was not found`,
        );
      }

      if (proposal.status === "completed") {
        return toSettledResult(
          proposal as Proposal & { readonly status: "completed"; readonly resultWorld: string },
          actionName,
          reportMode,
        );
      }

      if (hasSettledExecutionResult(proposal)) {
        return toSettledResult(
          proposal,
          actionName,
          reportMode,
        );
      }

      if (proposal.status === "failed") {
        return toFailedSettlementResult(proposal, actionName, reportMode);
      }

      if (isObservedTerminalProposal(proposal)) {
        return toObservedTerminalResult(proposal, actionName, reportMode);
      }

      if (!resumeAttempts.has(proposal.proposalId)) {
        resumeAttempts.add(proposal.proposalId);
        await kernel.enqueue(async () => {
          const latest = await governanceStore.getProposal(proposal.proposalId);
          if (latest) {
            await resumeStoredSettlement(latest);
          }
        });
      }

      await sleep(10);
    }
  }

  async function toObservedTerminalResult<Name extends ActionName<T>>(
    proposal: Proposal & { readonly status: "rejected" | "superseded" },
    actionName?: Name,
    reportMode?: SubmitReportMode,
  ): Promise<GovernanceSettlementResult<T, Name>> {
    const action = resolveSettlementAction(proposal, actionName);
    let decision: DecisionRecord | null = null;

    if (proposal.decisionId) {
      decision = await governanceStore.getDecisionRecord(proposal.decisionId);
      if (!decision) {
        const error = createMissingDecisionRecordError(proposal);
        return Object.freeze({
          ok: false,
          mode: "governance",
          status: "settlement_failed",
          action,
          proposal: proposal.proposalId,
          error,
          ...(reportMode === "none"
            ? {}
            : {
                report: Object.freeze({
                  mode: "governance",
                  status: "settlement_failed",
                  action,
                  proposal: proposal.proposalId,
                  stage: "observation",
                  error,
                }),
              }),
        }) as GovernanceSettlementResult<T, Name>;
      }
    }

    const frozenDecision = decision ? Object.freeze({ ...decision }) : undefined;
    return Object.freeze({
      ok: true,
      mode: "governance",
      status: proposal.status,
      action,
      proposal: proposal.proposalId,
      ...(frozenDecision ? { decision: frozenDecision } : {}),
      ...(reportMode === "none"
        ? {}
        : {
            report: Object.freeze({
              mode: "governance",
              status: proposal.status,
              action,
              proposal: proposal.proposalId,
              ...(frozenDecision ? { decision: frozenDecision } : {}),
            }),
          }),
    }) as GovernanceSettlementResult<T, Name>;
  }

  async function toSettledResult<Name extends ActionName<T>>(
    proposal: Proposal & { readonly status: "completed" | "failed"; readonly resultWorld: string },
    actionName?: Name,
    reportMode?: SubmitReportMode,
  ): Promise<GovernanceSettlementResult<T, Name>> {
    const action = resolveSettlementAction(proposal, actionName);
    const before = await lineage.getWorldSnapshot(proposal.baseWorld);
    if (!before) {
      throw new ManifestoError(
        "GOVERNANCE_BASE_WORLD_NOT_FOUND",
        `Proposal references missing base world "${proposal.baseWorld}"`,
      );
    }

    const after = await lineage.getWorldSnapshot(proposal.resultWorld);
    if (!after) {
      throw new ManifestoError(
        "GOVERNANCE_RESULT_WORLD_NOT_FOUND",
        `Proposal references missing result world "${proposal.resultWorld}"`,
      );
    }

    const world = await lineage.getWorld(proposal.resultWorld);
    if (!world) {
      throw new ManifestoError(
        "GOVERNANCE_RESULT_WORLD_NOT_FOUND",
        `Proposal references missing result world "${proposal.resultWorld}"`,
      );
    }

    const dispatchOutcome = kernel.deriveExecutionOutcome(before, after);
    const outcome = proposal.terminalOutcome ?? toSettlementOutcome(dispatchOutcome, proposal);
    const published = await isPublishedSettlement(proposal);

    return Object.freeze({
      ok: true,
      mode: "governance",
      status: "settled",
      action,
      proposal: proposal.proposalId,
      world: Object.freeze({ ...world }) as WorldRecord,
      before: dispatchOutcome.projected.beforeSnapshot,
      after: dispatchOutcome.projected.afterSnapshot,
      outcome,
      ...(reportMode === "none"
        ? {}
        : {
            report: Object.freeze({
              mode: "governance",
              status: "settled",
              action,
              proposal: proposal.proposalId,
              baseWorldId: proposal.baseWorld,
              worldId: proposal.resultWorld,
              sealedSnapshotHash: world.snapshotHash,
              published,
              outcome,
              changes: dispatchOutcome.projected.changedPaths,
              requirements: dispatchOutcome.canonical.pendingRequirements,
            }),
          }),
    }) as GovernanceSettlementResult<T, Name>;
  }

  async function isPublishedSettlement(
    proposal: Proposal & { readonly status: "completed" | "failed"; readonly resultWorld: string },
  ): Promise<boolean> {
    const activeBranch = await lineage.getActiveBranch();
    return activeBranch.id === proposal.branchId && activeBranch.head === proposal.resultWorld;
  }

  function hasSettledExecutionResult(
    proposal: Proposal,
  ): proposal is Proposal & {
    readonly status: "failed";
    readonly resultWorld: string;
    readonly terminalOutcome: ExecutionOutcome;
  } {
    return proposal.status === "failed"
      && proposal.resultWorld !== undefined
      && proposal.terminalOutcome !== undefined;
  }

  function isObservedTerminalProposal(
    proposal: Proposal,
  ): proposal is Proposal & { readonly status: "rejected" | "superseded" } {
    return proposal.status === "rejected" || proposal.status === "superseded";
  }

  async function toFailedSettlementResult<Name extends ActionName<T>>(
    proposal: Proposal,
    actionName?: Name,
    reportMode?: SubmitReportMode,
  ): Promise<GovernanceSettlementResult<T, Name>> {
    const action = resolveSettlementAction(proposal, actionName);
    const error = await loadSettlementError(proposal);
    return Object.freeze({
      ok: false,
      mode: "governance",
      status: "settlement_failed",
      action,
      proposal: proposal.proposalId,
      error,
      ...(reportMode === "none"
        ? {}
        : {
            report: Object.freeze({
              mode: "governance",
              status: "settlement_failed",
              action,
              proposal: proposal.proposalId,
              stage: "settlement",
              error,
            }),
          }),
    }) as GovernanceSettlementResult<T, Name>;
  }

  function createMissingDecisionRecordError(proposal: Proposal): ErrorValue {
    const snapshot = kernel.getCanonicalSnapshot();
    return Object.freeze({
      code: "GOVERNANCE_DECISION_RECORD_NOT_FOUND",
      message: `Proposal "${proposal.proposalId}" references missing decision record "${proposal.decisionId}"`,
      source: {
        actionId: proposal.intent.intentId,
        nodePath: "governance.waitForSettlement",
      },
      timestamp: snapshot.meta.timestamp,
    });
  }

  async function loadSettlementError(proposal: Proposal): Promise<ErrorValue> {
    if (proposal.resultWorld) {
      const snapshot = await lineage.getWorldSnapshot(proposal.resultWorld);
      if (snapshot) {
        const currentError = readSnapshotCurrentError(snapshot);
        if (currentError) {
          return currentError;
        }
      }
    }

    const snapshot = kernel.getCanonicalSnapshot();
    return Object.freeze({
      code: "GOVERNANCE_SETTLEMENT_FAILED",
      message: `Proposal "${proposal.proposalId}" failed before settlement completed`,
      source: {
        actionId: proposal.intent.intentId,
        nodePath: "governance.waitForSettlement",
      },
      timestamp: snapshot.meta.timestamp,
    });
  }

  function resolveSettlementAction<Name extends ActionName<T>>(
    proposal: Proposal,
    actionName?: Name,
  ): Name {
    return (actionName ?? proposal.intent.type) as Name;
  }

  return {
    waitForSettlement,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
