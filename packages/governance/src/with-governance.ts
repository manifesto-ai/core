import type {
  ComposableManifesto,
  GovernanceLaws,
  ManifestoDomainShape,
} from "@manifesto-ai/sdk";
import {
  DisposedError,
  ManifestoError,
} from "@manifesto-ai/sdk";
import {
  activateComposable,
  assertComposableNotActivated,
  attachRuntimeKernelFactory,
  getActivationState,
  getRuntimeKernelFactory,
  type RuntimeKernel,
} from "@manifesto-ai/sdk/internal";
import type { Intent as CoreIntent } from "@manifesto-ai/core";
import {
  type BranchId,
} from "@manifesto-ai/lineage";
import {
  createLineageRuntimeController,
  getLineageDecoration,
  type ResolvedLineageConfig,
} from "@manifesto-ai/lineage/internal";

import { createAuthorityEvaluator, type AuthorityEvaluator } from "./authority/evaluator.js";
import { createGovernanceEventDispatcher } from "./event-dispatcher.js";
import { createIntentInstance } from "./intent-instance.js";
import { createGovernanceService } from "./service/governance-service.js";
import { createInMemoryGovernanceStore } from "./store/in-memory-governance-store.js";
import type {
  GovernanceComposableManifesto,
  GovernanceConfig,
  GovernedComposableLaws,
  GovernanceInstance,
  LineageComposableManifestoInput,
} from "./runtime-types.js";
import type {
  ActorAuthorityBinding,
  AuthorityResponse,
  DecisionRecord,
  GovernanceStore,
  IntentScope,
  Proposal,
  ProposalId,
} from "./types.js";
import {
  createProposalId,
  defaultExecutionKeyPolicy,
} from "./types.js";

const GOVERNANCE_LAWS: GovernanceLaws = Object.freeze({ __governanceLaws: true });

export function withGovernance<
  T extends ManifestoDomainShape,
>(
  manifesto: LineageComposableManifestoInput<T>,
  config: GovernanceConfig,
): GovernanceComposableManifesto<T> {
  assertComposableNotActivated(manifesto);

  const createKernel = getRuntimeKernelFactory(manifesto);
  const explicitLineage = getLineageDecoration(manifesto);
  if (!explicitLineage) {
    throw new ManifestoError(
      "GOVERNANCE_LINEAGE_REQUIRED",
      "withGovernance() requires a manifesto already composed with withLineage()",
    );
  }
  const activationState = getActivationState(manifesto);

  const decorated: GovernanceComposableManifesto<T> = {
    _laws: Object.freeze({
      ...manifesto._laws,
      ...GOVERNANCE_LAWS,
    }) as GovernedComposableLaws,
    schema: manifesto.schema,
    activate() {
      activateComposable(
        decorated as unknown as ComposableManifesto<T, GovernedComposableLaws>,
      );
      return activateGovernanceRuntime<T>(
        createKernel(),
        explicitLineage.config,
        config,
      );
    },
  };

  attachRuntimeKernelFactory(
    decorated as unknown as ComposableManifesto<T, GovernedComposableLaws>,
    createKernel,
    activationState,
  );

  return decorated;
}

function activateGovernanceRuntime<T extends ManifestoDomainShape>(
  kernel: RuntimeKernel<T>,
  lineageConfig: ResolvedLineageConfig,
  config: GovernanceConfig,
): GovernanceInstance<T> {
  const governanceStore = config.governanceStore ?? createInMemoryGovernanceStore();
  const governanceService = createGovernanceService(governanceStore, {
    lineageService: lineageConfig.service,
  });
  const evaluator = config.evaluator ?? createAuthorityEvaluator();
  const eventDispatcher = createGovernanceEventDispatcher({
    service: governanceService,
    sink: config.eventSink,
    now: config.now,
  });
  const now = config.now ?? Date.now;
  const lineage = createLineageRuntimeController(kernel, lineageConfig.service, lineageConfig);

  let bindingsReady: Promise<void> | null = null;

  async function ensureBindings(): Promise<void> {
    if (bindingsReady) {
      return bindingsReady;
    }

    bindingsReady = Promise
      .all(config.bindings.map(async (binding) => {
        await governanceStore.putActorBinding(binding);
      }))
      .then(() => undefined)
      .catch((error) => {
        bindingsReady = null;
        throw error;
      });

    return bindingsReady;
  }

  async function ensureReady(): Promise<void> {
    await lineage.ensureReady();
    await ensureBindings();
  }

  function getCurrentTimestamp(): number {
    return now();
  }

  async function invalidateStaleIngress(branchId: BranchId, epoch: number): Promise<void> {
    const stale = await governanceService.invalidateStaleIngress(branchId, epoch);
    await Promise.all(stale.map(async (proposal) => {
      await governanceStore.putProposal(proposal);
    }));
  }

  async function resolveBinding(
    actorId: string,
  ): Promise<ActorAuthorityBinding> {
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

  async function finalizeApprovedExecution(
    executingProposal: Proposal & { readonly status: "executing" },
    intent: CoreIntent,
  ): Promise<Proposal> {
    let sealed: Awaited<ReturnType<typeof lineage.sealIntent>> | null = null;
    let terminalProposal: Proposal | null = null;
    let proposalPersisted = false;

    try {
      sealed = await lineage.sealIntent(intent, {
        proposalRef: executingProposal.proposalId,
        decisionRef: executingProposal.decisionId,
        executionKey: executingProposal.executionKey,
        publishOnCompleted: false,
        assumeEnqueued: true,
      });

      const governanceCommit = await governanceService.finalize(
        executingProposal,
        sealed.preparedCommit,
        getCurrentTimestamp(),
      );
      terminalProposal = governanceCommit.proposal;

      await governanceStore.putProposal(governanceCommit.proposal);
      proposalPersisted = true;
      await governanceStore.putDecisionRecord(governanceCommit.decisionRecord);
      eventDispatcher.emitSealCompleted(governanceCommit, sealed.preparedCommit);

      if (sealed.preparedCommit.branchChange.headAdvanced) {
        const publishedSnapshot = kernel.setVisibleSnapshot(sealed.hostResult.snapshot);
        kernel.emitEvent("dispatch:completed", {
          intentId: intent.intentId ?? "",
          intent,
          snapshot: publishedSnapshot,
        });
        return governanceCommit.proposal;
      }

      const failure = toGovernanceFailure(sealed.hostResult.error);
      kernel.emitEvent("dispatch:failed", {
        intentId: intent.intentId ?? "",
        intent,
        error: failure,
      });
      return governanceCommit.proposal;
    } catch (error) {
      const failure = toGovernanceFailure(error);
      if (!proposalPersisted) {
        try {
          if (terminalProposal) {
            await governanceStore.putProposal(terminalProposal);
          } else if (!sealed) {
            const failedProposal = governanceService.failExecution(
              executingProposal,
              getCurrentTimestamp(),
            );
            await governanceStore.putProposal(failedProposal);
          }
        } catch {
          // Preserve the original execution failure if compensating persistence also fails.
        }
      }
      if (!isActionUnavailable(failure)) {
        kernel.emitEvent("dispatch:failed", {
          intentId: intent.intentId ?? "",
          intent,
          error: failure,
        });
      }
      throw failure;
    }
  }

  async function applyAuthorityDecision(
    proposal: Proposal & { readonly status: "evaluating" },
    response: Extract<AuthorityResponse, { kind: "approved" | "rejected" }>,
  ): Promise<Proposal> {
    const prepared = await governanceService.prepareAuthorityResult(
      proposal,
      response,
      {
        decidedAt: getCurrentTimestamp(),
      },
    );

    await governanceStore.putProposal(prepared.proposal);
    if (prepared.decisionRecord) {
      await governanceStore.putDecisionRecord(prepared.decisionRecord);
    }

    if (prepared.discarded || prepared.proposal.status === "rejected") {
      return prepared.proposal;
    }

    const executingProposal = governanceService.beginExecution(prepared.proposal);
    await governanceStore.putProposal(executingProposal);

    return finalizeApprovedExecution(executingProposal, toCoreIntent(prepared.proposal));
  }

  async function proposeAsync(intent: CoreIntent): Promise<Proposal> {
    if (kernel.isDisposed()) {
      throw new DisposedError();
    }

    return kernel.enqueue(async () => {
      if (kernel.isDisposed()) {
        throw new DisposedError();
      }

      await ensureReady();

      const enrichedIntent = kernel.ensureIntentId(intent);
      if (!kernel.isActionAvailable(enrichedIntent.type as keyof T["actions"])) {
        return kernel.rejectUnavailable(enrichedIntent);
      }

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
      const proposal = governanceService.createProposal({
        proposalId,
        baseWorld: branch.head,
        branchId: branch.id,
        actorId: binding.actorId,
        authorityId: binding.authorityId,
        intent: {
          type: intentInstance.body.type,
          intentId: intentInstance.intentId,
          ...(intentInstance.body.input !== undefined
            ? { input: intentInstance.body.input }
            : {}),
          ...(intentInstance.body.scopeProposal !== undefined
            ? { scopeProposal: intentInstance.body.scopeProposal }
            : {}),
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

      const evaluatingProposal = governanceService.beginEvaluating(proposal);
      await governanceStore.putProposal(evaluatingProposal);

      const response = await evaluateProposal(evaluatingProposal, binding, evaluator);
      if (response.kind === "pending") {
        return evaluatingProposal;
      }

      return applyAuthorityDecision(evaluatingProposal, response);
    });
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
          approvedScope !== undefined
            ? approvedScope
            : proposal.intent.scopeProposal ?? null,
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

  async function getProposal(proposalId: ProposalId): Promise<Proposal | null> {
    await ensureBindings();
    return governanceStore.getProposal(proposalId);
  }

  async function getProposals(branchId?: BranchId): Promise<readonly Proposal[]> {
    await ensureReady();
    const resolvedBranchId = branchId ?? (await lineage.getActiveBranch()).id;
    return governanceStore.getProposalsByBranch(resolvedBranchId);
  }

  async function bindActor(binding: ActorAuthorityBinding): Promise<void> {
    if (kernel.isDisposed()) {
      throw new DisposedError();
    }

    return kernel.enqueue(async () => {
      if (kernel.isDisposed()) {
        throw new DisposedError();
      }

      await ensureBindings();
      await governanceStore.putActorBinding(binding);
    });
  }

  async function getActorBinding(actorId: string): Promise<ActorAuthorityBinding | null> {
    await ensureBindings();
    return governanceStore.getActorBinding(actorId);
  }

  async function getDecisionRecord(
    decisionId: DecisionRecord["decisionId"],
  ): Promise<DecisionRecord | null> {
    await ensureBindings();
    return governanceStore.getDecisionRecord(decisionId);
  }

  const governed = {
    createIntent: kernel.createIntent,
    subscribe: kernel.subscribe,
    on: kernel.on,
    getSnapshot: kernel.getSnapshot,
    getAvailableActions: kernel.getAvailableActions,
    isActionAvailable: kernel.isActionAvailable,
    MEL: kernel.MEL,
    schema: kernel.schema,
    dispose: kernel.dispose,
    restore: lineage.restore,
    getWorld: lineage.getWorld,
    getLineage: lineage.getLineage,
    getLatestHead: lineage.getLatestHead,
    getHeads: lineage.getHeads,
    getBranches: lineage.getBranches,
    getActiveBranch: lineage.getActiveBranch,
    switchActiveBranch: lineage.switchActiveBranch,
    createBranch: lineage.createBranch,
    proposeAsync,
    approve,
    reject,
    getProposal,
    getProposals,
    bindActor,
    getActorBinding,
    getDecisionRecord,
  };

  return governed satisfies GovernanceInstance<T>;
}

function toCoreIntent(proposal: Proposal): CoreIntent {
  return {
    type: proposal.intent.type,
    intentId: proposal.intent.intentId,
    ...(proposal.intent.input !== undefined ? { input: proposal.intent.input } : {}),
  };
}

function hasScopeProposal(intent: CoreIntent): intent is CoreIntent & {
  readonly scopeProposal: IntentScope;
} {
  return "scopeProposal" in intent && intent.scopeProposal !== undefined;
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

function isActionUnavailable(error: Error): boolean {
  return "code" in error
    && typeof error.code === "string"
    && error.code === "ACTION_UNAVAILABLE";
}
