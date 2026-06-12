import type { Context } from "@manifesto-ai/core";
import type { ManifestoDomainShape, TypedIntent } from "@manifesto-ai/sdk";
import { DisposedError, ManifestoError } from "@manifesto-ai/sdk";
import { type BranchId } from "@manifesto-ai/lineage";

import type { AuthorityEvaluator } from "./authority/evaluator.js";
import { createIntentInstance } from "./intent-instance.js";
import type { GovernanceRuntimeDeps } from "./runtime-deps.js";
import { toTypedComputeIntent, type SettlementEngine } from "./settlement.js";
import type {
  ActorAuthorityBinding,
  AuthorityResponse,
  IntentScope,
  Proposal,
  ProposalId,
} from "./types.js";
import { createProposalId, defaultExecutionKeyPolicy } from "./types.js";

/**
 * Submission/authority decision seam: proposal ingress, authority
 * evaluation, decision application, and the explicit approve/reject paths.
 */
export interface SubmissionFlow<T extends ManifestoDomainShape> {
  createSubmission(intent: TypedIntent<T>, context: Context): Promise<Proposal>;
  settleSubmission(proposalId: ProposalId): Promise<void>;
  approve(proposalId: ProposalId, approvedScope?: IntentScope | null): Promise<Proposal>;
  reject(proposalId: ProposalId, reason?: string): Promise<Proposal>;
}

export function createSubmissionFlow<T extends ManifestoDomainShape>(
  deps: GovernanceRuntimeDeps<T>,
  settlement: SettlementEngine<T>,
): SubmissionFlow<T> {
  const {
    kernel,
    lineage,
    config,
    governanceService,
    governanceStore,
    evaluator,
    getCurrentTimestamp,
    ensureReady,
    proposalSubmissionBindings,
    activeSettlementTasks,
  } = deps;
  const { finalizeApprovedExecution, compensateSettlementFailure } = settlement;

  async function invalidateStaleIngress(branchId: BranchId, epoch: number): Promise<void> {
    const stale = await governanceService.invalidateStaleIngress(branchId, epoch);
    await Promise.all(
      stale.map(async (proposal) => {
        await governanceStore.putProposal(proposal);
      }),
    );
  }

  async function resolveBinding(actorId: string): Promise<ActorAuthorityBinding> {
    const binding = await governanceStore.getActorBinding(actorId);
    if (binding) {
      return binding;
    }

    throw new ManifestoError(
      "GOVERNANCE_BINDING_NOT_FOUND",
      `No actor-authority binding exists for actor "${actorId}"`,
    );
  }

  async function evaluateProposal(
    proposal: Proposal,
    binding: ActorAuthorityBinding,
    activeEvaluator: AuthorityEvaluator,
  ): Promise<AuthorityResponse> {
    switch (binding.policy.mode) {
      case "hitl":
        return {
          kind: "pending",
          waitingFor: {
            kind: "human",
            delegate: binding.policy.delegate,
          },
        };
      case "tribunal":
        return {
          kind: "pending",
          waitingFor: {
            kind: "tribunal",
            members: binding.policy.members,
          },
        };
      default:
        return activeEvaluator.evaluate(proposal, binding);
    }
  }

  async function applyAuthorityDecision(
    proposal: Proposal & { readonly status: "evaluating" },
    response: Extract<AuthorityResponse, { kind: "approved" | "rejected" }>,
  ): Promise<Proposal> {
    const prepared = await governanceService.prepareAuthorityResult(proposal, response, {
      decidedAt: getCurrentTimestamp(),
    });

    if (prepared.decisionRecord) {
      await governanceStore.putDecisionRecord(prepared.decisionRecord);
    }
    await governanceStore.putProposal(prepared.proposal);

    if (prepared.discarded || prepared.proposal.status === "rejected") {
      return prepared.proposal;
    }

    const executingProposal = governanceService.beginExecution(prepared.proposal);
    await governanceStore.putProposal(executingProposal);

    return finalizeApprovedExecution(executingProposal, toTypedComputeIntent<T>(prepared.proposal));
  }

  async function createSubmission(intent: TypedIntent<T>, context: Context): Promise<Proposal> {
    await ensureReady();

    const enrichedIntent = kernel.ensureIntentId(intent);
    const branch = await lineage.getActiveBranch();
    await invalidateStaleIngress(branch.id, branch.epoch);

    const actor = config.execution.deriveActor(enrichedIntent);
    const binding = await resolveBinding(actor.actorId);
    const intentInstance = await createIntentInstance({
      body: {
        type: enrichedIntent.type,
        ...(enrichedIntent.input !== undefined ? { input: enrichedIntent.input } : {}),
        ...(hasScopeProposal(enrichedIntent)
          ? { scopeProposal: enrichedIntent.scopeProposal }
          : {}),
      },
      schemaHash: kernel.schema.hash,
      projectionId: config.execution.projectionId,
      source: config.execution.deriveSource(enrichedIntent),
      actor,
      intentId: enrichedIntent.intentId,
    });

    const proposalId = createProposalId();
    const computeIntent = {
      type: intentInstance.body.type,
      intentId: intentInstance.intentId,
      ...(intentInstance.body.input !== undefined ? { input: intentInstance.body.input } : {}),
    };
    const proposalIntent = {
      ...computeIntent,
      ...(intentInstance.body.scopeProposal !== undefined
        ? { scopeProposal: intentInstance.body.scopeProposal }
        : {}),
    };
    const proposal = governanceService.createProposal({
      proposalId,
      baseWorld: branch.head,
      branchId: branch.id,
      actorId: binding.actorId,
      authorityId: binding.authorityId,
      intent: proposalIntent,
      computeEnvelope: {
        intent: computeIntent,
        context,
      },
      executionKey: defaultExecutionKeyPolicy({
        proposalId,
        actorId: binding.actorId,
        baseWorld: branch.head,
        branchId: branch.id,
        attempt: 1,
      }),
      submittedAt: getCurrentTimestamp(),
      epoch: branch.epoch,
    });

    await governanceStore.putProposal(proposal);
    proposalSubmissionBindings.set(proposalId, binding);

    const evaluatingProposal = governanceService.beginEvaluating(proposal);
    try {
      await governanceStore.putProposal(evaluatingProposal);
    } catch {
      return proposal;
    }

    return evaluatingProposal;
  }

  async function settleSubmission(proposalId: ProposalId): Promise<void> {
    if (activeSettlementTasks.has(proposalId)) {
      return;
    }

    activeSettlementTasks.add(proposalId);
    try {
      await settleSubmissionOnce(proposalId);
    } finally {
      activeSettlementTasks.delete(proposalId);
    }
  }

  async function settleSubmissionOnce(proposalId: ProposalId): Promise<void> {
    if (kernel.isDisposed()) {
      throw new DisposedError();
    }

    await ensureReady();
    const proposal = await governanceStore.getProposal(proposalId);
    if (!proposal) {
      return;
    }

    let evaluatingProposal: Proposal & { readonly status: "evaluating" };
    if (proposal.status === "submitted") {
      evaluatingProposal = governanceService.beginEvaluating(proposal);
      await governanceStore.putProposal(evaluatingProposal);
    } else if (proposal.status === "evaluating") {
      evaluatingProposal = proposal as Proposal & { readonly status: "evaluating" };
    } else {
      return;
    }

    const binding =
      proposalSubmissionBindings.get(proposalId) ??
      (await resolveBinding(evaluatingProposal.actorId));
    proposalSubmissionBindings.delete(proposalId);

    try {
      const response = await evaluateProposal(evaluatingProposal, binding, evaluator);
      if (response.kind === "pending") {
        return;
      }

      await applyAuthorityDecision(evaluatingProposal, response);
    } catch {
      await compensateSettlementFailure(proposalId, evaluatingProposal);
    }
  }

  async function getEvaluatingProposal(proposalId: ProposalId) {
    const proposal = await governanceStore.getProposal(proposalId);
    if (!proposal) {
      throw new ManifestoError(
        "GOVERNANCE_PROPOSAL_NOT_FOUND",
        `Proposal "${proposalId}" was not found`,
      );
    }

    if (proposal.status !== "evaluating") {
      throw new ManifestoError(
        "GOVERNANCE_PENDING_REQUIRED",
        `Proposal "${proposalId}" is not pending human resolution`,
      );
    }

    return proposal as Proposal & { readonly status: "evaluating" };
  }

  async function approve(
    proposalId: ProposalId,
    approvedScope?: IntentScope | null,
  ): Promise<Proposal> {
    if (kernel.isDisposed()) {
      throw new DisposedError();
    }

    return kernel.enqueue(async () => {
      if (kernel.isDisposed()) {
        throw new DisposedError();
      }

      await ensureReady();
      const proposal = await getEvaluatingProposal(proposalId);
      return applyAuthorityDecision(proposal, {
        kind: "approved",
        approvedScope:
          approvedScope !== undefined ? approvedScope : (proposal.intent.scopeProposal ?? null),
      });
    });
  }

  async function reject(proposalId: ProposalId, reason?: string): Promise<Proposal> {
    if (kernel.isDisposed()) {
      throw new DisposedError();
    }

    return kernel.enqueue(async () => {
      if (kernel.isDisposed()) {
        throw new DisposedError();
      }

      await ensureReady();
      const proposal = await getEvaluatingProposal(proposalId);
      return applyAuthorityDecision(proposal, {
        kind: "rejected",
        ...(reason ? { reason } : {}),
      });
    });
  }

  return {
    createSubmission,
    settleSubmission,
    approve,
    reject,
  };
}

function hasScopeProposal<T extends ManifestoDomainShape>(
  intent: TypedIntent<T>,
): intent is TypedIntent<T> & {
  readonly scopeProposal: IntentScope;
} {
  return "scopeProposal" in intent && intent.scopeProposal !== undefined;
}
