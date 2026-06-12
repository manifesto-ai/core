import type { ManifestoDomainShape } from "@manifesto-ai/sdk";

import type { GovernanceRuntimeDeps } from "./runtime-deps.js";
import { toTypedComputeIntent, type SettlementEngine } from "./settlement.js";
import type { SubmissionFlow } from "./submission.js";
import type { Proposal, ProposalId } from "./types.js";

/**
 * Recovery seam: resumes stored, unsettled proposals after activation or on
 * demand from settlement observation, without re-executing host effects.
 */
export interface SettlementRecovery {
  resumeStoredSettlement(proposal: Proposal): Promise<void>;
  resumePendingSettlements(): Promise<void>;
}

export function createSettlementRecovery<T extends ManifestoDomainShape>(
  deps: GovernanceRuntimeDeps<T>,
  settlement: SettlementEngine<T>,
  submission: Pick<SubmissionFlow<T>, "settleSubmission">,
): SettlementRecovery {
  const {
    kernel,
    lineage,
    lineageService,
    governanceService,
    governanceStore,
    ensureReady,
    activeSettlementTasks,
  } = deps;
  const { finalizeApprovedExecution, compensateSettlementFailure } = settlement;
  const { settleSubmission } = submission;

  async function resumeStoredSettlement(proposal: Proposal): Promise<void> {
    if (proposal.status === "submitted") {
      await settleSubmission(proposal.proposalId);
      return;
    }

    if (proposal.status === "evaluating") {
      await settleSubmission(proposal.proposalId);
      return;
    }

    if (proposal.status !== "approved" && proposal.status !== "executing") {
      return;
    }

    if (activeSettlementTasks.has(proposal.proposalId)) {
      return;
    }

    activeSettlementTasks.add(proposal.proposalId);
    try {
      if (proposal.status === "approved") {
        const executingProposal = governanceService.beginExecution(proposal);
        await governanceStore.putProposal(executingProposal);
        try {
          await finalizeApprovedExecution(executingProposal, toTypedComputeIntent<T>(proposal));
        } catch {
          await compensateSettlementFailure(proposal.proposalId, executingProposal);
        }
        return;
      }

      // Effect-safe recovery (#479): an "executing" proposal carries no
      // durable evidence of whether host effects already ran before the
      // crash. Re-dispatching could duplicate external side effects, so
      // recovery never re-executes. If the seal completed (a world
      // referencing this proposal exists in lineage), that world is recorded
      // on the failed proposal for explicit reconciliation; otherwise the
      // proposal fails as unverifiable. Proposals recovered in "approved"
      // state are safe to execute above: execution begins only after the
      // "executing" transition is durably persisted.
      const executingProposal = proposal as Proposal & { readonly status: "executing" };
      let sealedWorldId: string | undefined;
      try {
        const attempts = await lineageService.getAttemptsByBranch(executingProposal.branchId);
        sealedWorldId = attempts.find(
          (attempt) => attempt.proposalRef === executingProposal.proposalId,
        )?.worldId;
      } catch {
        // Lineage lookup is best-effort evidence gathering; recovery still
        // refuses to re-execute below.
      }

      await compensateSettlementFailure(
        executingProposal.proposalId,
        executingProposal,
        sealedWorldId,
      );
    } finally {
      activeSettlementTasks.delete(proposal.proposalId);
    }
  }

  async function resumePendingSettlements(): Promise<void> {
    if (kernel.isDisposed()) {
      return;
    }

    await ensureReady();
    const branches = await lineage.getBranches();
    const visited = new Set<ProposalId>();

    for (const branch of branches) {
      const proposals = await governanceStore.getProposalsByBranch(branch.id);

      for (const proposal of proposals) {
        if (kernel.isDisposed()) {
          return;
        }

        if (visited.has(proposal.proposalId)) {
          continue;
        }
        visited.add(proposal.proposalId);

        if (
          proposal.status === "submitted" ||
          proposal.status === "evaluating" ||
          proposal.status === "approved" ||
          proposal.status === "executing"
        ) {
          await resumeStoredSettlement(proposal);
        }
      }
    }
  }

  return {
    resumeStoredSettlement,
    resumePendingSettlements,
  };
}
