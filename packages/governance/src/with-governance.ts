import type {
  ErrorValue,
} from "@manifesto-ai/core";
import type {
  ActionName,
  CanonicalSnapshot,
  ComposableManifesto,
  DispatchExecutionOutcome,
  ExecutionOutcome,
  GovernanceSettlementResult,
  GovernanceLaws,
  ManifestoDomainShape,
  ProposalRef,
  TypedIntent,
  WorldRecord,
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
  type GovernanceRuntimeKernel,
  type GovernanceRuntimeKernelFactory,
} from "@manifesto-ai/sdk/provider";
import {
  type BranchId,
} from "@manifesto-ai/lineage";
import {
  createLineageRuntimeController,
  getLineageDecoration,
  type ResolvedLineageConfig,
} from "@manifesto-ai/lineage/provider";

import { createAuthorityEvaluator, type AuthorityEvaluator } from "./authority/evaluator.js";
import { createGovernanceEventDispatcher } from "./event-dispatcher.js";
import { createGovernanceRuntimeInstance } from "./governance-runtime.js";
import { createIntentInstance } from "./intent-instance.js";
import { createGovernanceService } from "./service/governance-service.js";
import { createInMemoryGovernanceStore } from "./store/in-memory-governance-store.js";
import { attachWaitForProposalRuntime } from "./wait-for-proposal.js";
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
  config: GovernanceConfig<T>,
): GovernanceComposableManifesto<T> {
  assertComposableNotActivated(manifesto);

  const createKernel = getRuntimeKernelFactory(manifesto);
  const createGovernanceKernel: GovernanceRuntimeKernelFactory<T> = createKernel;
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
        createGovernanceKernel(),
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
  kernel: GovernanceRuntimeKernel<T>,
  lineageConfig: ResolvedLineageConfig,
  config: GovernanceConfig<T>,
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
  let runtime!: GovernanceInstance<T>;

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
    intent: TypedIntent<T>,
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
        kernel.setVisibleSnapshot(sealed.hostResult.snapshot);
        return governanceCommit.proposal;
      }

      return governanceCommit.proposal;
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

    return finalizeApprovedExecution(executingProposal, toTypedIntent<T>(prepared.proposal));
  }

  async function createSubmission(intent: TypedIntent<T>): Promise<Proposal> {
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

    return evaluatingProposal;
  }

  async function settleSubmission(proposalId: ProposalId): Promise<void> {
    if (kernel.isDisposed()) {
      throw new DisposedError();
    }

    await ensureReady();
    const proposal = await governanceStore.getProposal(proposalId);
    if (!proposal || proposal.status !== "evaluating") {
      return;
    }

    const evaluatingProposal = proposal as Proposal & { readonly status: "evaluating" };
    const binding = await resolveBinding(evaluatingProposal.actorId);
    const response = await evaluateProposal(evaluatingProposal, binding, evaluator);
    if (response.kind === "pending") {
      return;
    }

    try {
      await applyAuthorityDecision(evaluatingProposal, response);
    } catch {
      const current = await governanceStore.getProposal(proposalId);
      if (
        current
        && current.status !== "completed"
        && current.status !== "failed"
        && current.status !== "rejected"
        && current.status !== "superseded"
      ) {
        await governanceStore.putProposal(
          governanceService.failExecution(
            evaluatingProposal,
            getCurrentTimestamp(),
          ),
        );
      }
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

  async function waitForSettlement<Name extends ActionName<T>>(
    proposalRef: ProposalRef,
    actionName?: Name,
  ): Promise<GovernanceSettlementResult<T, Name>> {
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
        );
      }

      if (proposal.status === "failed") {
        return toFailedSettlementResult(proposal, actionName);
      }

      if (proposal.status === "rejected" || proposal.status === "superseded") {
        const action = resolveSettlementAction(proposal, actionName);
        return Object.freeze({
          ok: true,
          mode: "governance",
          status: proposal.status,
          action,
          proposal: proposal.proposalId,
          ...(proposal.decisionId
            ? { decision: Object.freeze({ decisionId: proposal.decisionId }) }
            : {}),
        }) as GovernanceSettlementResult<T, Name>;
      }

      await sleep(10);
    }
  }

  async function toSettledResult<Name extends ActionName<T>>(
    proposal: Proposal & { readonly status: "completed"; readonly resultWorld: string },
    actionName?: Name,
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
    const outcome = toSettlementOutcome(dispatchOutcome, proposal);

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
      report: Object.freeze({
        mode: "governance",
        status: "settled",
        action,
        proposal: proposal.proposalId,
        baseWorldId: proposal.baseWorld,
        worldId: proposal.resultWorld,
        sealedSnapshotHash: world.snapshotHash,
        published: true,
        outcome,
        changes: dispatchOutcome.projected.changedPaths,
        requirements: dispatchOutcome.canonical.pendingRequirements,
      }),
    }) as GovernanceSettlementResult<T, Name>;
  }

  async function toFailedSettlementResult<Name extends ActionName<T>>(
    proposal: Proposal,
    actionName?: Name,
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
      report: Object.freeze({
        mode: "governance",
        status: "settlement_failed",
        action,
        proposal: proposal.proposalId,
        stage: "settlement",
        error,
      }),
    }) as GovernanceSettlementResult<T, Name>;
  }

  async function loadSettlementError(proposal: Proposal): Promise<ErrorValue> {
    if (proposal.resultWorld) {
      const snapshot = await lineage.getWorldSnapshot(proposal.resultWorld);
      if (snapshot?.system.lastError) {
        return snapshot.system.lastError;
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

  const governed = createGovernanceRuntimeInstance(kernel, {
    lineage,
    ensureReady,
    createSubmission,
    settleSubmission,
    waitForSettlement,
    approve,
    reject,
    getProposal,
    getProposals,
    bindActor,
    getActorBinding,
    getDecisionRecord,
  });

  runtime = attachWaitForProposalRuntime(
    governed,
    {
      isDisposed: kernel.isDisposed,
      deriveExecutionOutcome: kernel.deriveExecutionOutcome,
    },
  );

  return Object.freeze(runtime);
}

function toTypedIntent<T extends ManifestoDomainShape>(proposal: Proposal): TypedIntent<T> {
  return {
    type: proposal.intent.type,
    intentId: proposal.intent.intentId,
    ...(proposal.intent.input !== undefined ? { input: proposal.intent.input } : {}),
  } as TypedIntent<T>;
}

function hasScopeProposal<T extends ManifestoDomainShape>(intent: TypedIntent<T>): intent is TypedIntent<T> & {
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

function toSettlementOutcome<T extends ManifestoDomainShape>(
  dispatchOutcome: DispatchExecutionOutcome<T>,
  proposal: Proposal,
): ExecutionOutcome {
  const after = dispatchOutcome.canonical.afterCanonicalSnapshot;
  if (after.system.lastError) {
    return Object.freeze({
      kind: "fail",
      error: after.system.lastError,
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
