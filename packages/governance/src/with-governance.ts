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

import { createAuthorityEvaluator } from "./authority/evaluator.js";
import { createGovernanceEventDispatcher } from "./event-dispatcher.js";
import { createGovernanceRuntimeInstance } from "./governance-runtime.js";
import { createSettlementRecovery } from "./recovery.js";
import type { GovernanceRuntimeDeps } from "./runtime-deps.js";
import { createGovernanceService } from "./service/governance-service.js";
import { createSettlementEngine } from "./settlement.js";
import { createSettlementObservation } from "./settlement-observation.js";
import { createInMemoryGovernanceStore } from "./store/in-memory-governance-store.js";
import { createSubmissionFlow } from "./submission.js";
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
  DecisionRecord,
  Proposal,
  ProposalId,
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

  const deps: GovernanceRuntimeDeps<T> = {
    kernel,
    lineage,
    lineageService: lineageConfig.service,
    config,
    governanceService,
    governanceStore,
    evaluator,
    eventDispatcher,
    getCurrentTimestamp,
    ensureReady,
    proposalSubmissionBindings,
    activeSettlementTasks,
  };

  const settlement = createSettlementEngine(deps);
  const submission = createSubmissionFlow(deps, settlement);
  const recovery = createSettlementRecovery(deps, settlement, submission);
  const observation = createSettlementObservation(deps, recovery);

  const { createSubmission, settleSubmission, approve, reject } = submission;
  const { resumePendingSettlements } = recovery;
  const { waitForSettlement } = observation;

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
