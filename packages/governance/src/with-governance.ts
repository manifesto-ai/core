import type {
  Context,
  ErrorValue,
} from "@manifesto-ai/core";
import type {
  ActionName,
  CanonicalSnapshot,
  ComposableManifesto,
  DispatchExecutionOutcome,
  ExecutionDiagnostics,
  ExecutionOutcome,
  GovernanceSettlementResult,
  GovernanceLaws,
  ManifestoDomainShape,
  ProposalRef,
  SubmitReportMode,
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
import {
  collectChangedStatePaths,
  findScopeViolations,
  toIntentScope,
} from "./governance-scope.js";
import { createGovernanceRuntimeInstance } from "./governance-runtime.js";
import { createIntentInstance } from "./intent-instance.js";
import { createGovernanceService } from "./service/governance-service.js";
import { readSnapshotCurrentError } from "./snapshot-errors.js";
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
  const proposalSubmissionBindings = new Map<ProposalId, ActorAuthorityBinding>();
  const activeSettlementTasks = new Set<ProposalId>();

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

    if (prepared.decisionRecord) {
      await governanceStore.putDecisionRecord(prepared.decisionRecord);
    }
    await governanceStore.putProposal(prepared.proposal);

    if (prepared.discarded || prepared.proposal.status === "rejected") {
      return prepared.proposal;
    }

    const executingProposal = governanceService.beginExecution(prepared.proposal);
    await governanceStore.putProposal(executingProposal);

    return finalizeApprovedExecution(
      executingProposal,
      toTypedComputeIntent<T>(prepared.proposal),
    );
  }

  async function createSubmission(
    intent: TypedIntent<T>,
    context: Context,
  ): Promise<Proposal> {
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
      ...(intentInstance.body.input !== undefined
        ? { input: intentInstance.body.input }
        : {}),
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

    const binding = proposalSubmissionBindings.get(proposalId)
      ?? await resolveBinding(evaluatingProposal.actorId);
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
          await finalizeApprovedExecution(
            executingProposal,
            toTypedComputeIntent<T>(proposal),
          );
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
        const attempts = await lineageConfig.service.getAttemptsByBranch(
          executingProposal.branchId,
        );
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
          proposal.status === "submitted"
          || proposal.status === "evaluating"
          || proposal.status === "approved"
          || proposal.status === "executing"
        ) {
          await resumeStoredSettlement(proposal);
        }
      }
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

  const governed = createGovernanceRuntimeInstance(kernel, {
    lineage,
    ensureReady,
    createSubmission,
    settleSubmission,
    resumePendingSettlements,
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

  void kernel.enqueue(resumePendingSettlements).catch(() => {
    // Activation recovery is best-effort; proposal-specific waiters surface terminal state.
  });

  return Object.freeze(runtime);
}

function toTypedComputeIntent<T extends ManifestoDomainShape>(proposal: Proposal): TypedIntent<T> {
  return {
    type: proposal.computeEnvelope.intent.type,
    intentId: proposal.computeEnvelope.intent.intentId,
    ...(proposal.computeEnvelope.intent.input !== undefined
      ? { input: proposal.computeEnvelope.intent.input }
      : {}),
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
