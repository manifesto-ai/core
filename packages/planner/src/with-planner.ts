import type {
  CoreSnapshot,
  CreateIntentArgs,
  TypedActionRef,
  TypedIntent,
  CanonicalSnapshot,
  ManifestoDomainShape,
  Snapshot,
} from "@manifesto-ai/sdk";
import {
  ManifestoError,
} from "@manifesto-ai/sdk";
import {
  assertComposableNotActivated,
  getRuntimeKernelFactory,
  type RuntimeKernel,
} from "@manifesto-ai/sdk/provider";
import type { GovernanceInstance } from "@manifesto-ai/governance";

import { PlannerActivationError } from "./errors.js";
import {
  clampPlanOptions,
  createCandidateId,
  freezeHardPolicy,
  freezeValue,
  getPlannerInternals,
  isCoreEnumerator,
  toActionCandidate,
  toProjectedStep,
} from "./internal.js";
import { createCoreEnumerator } from "./enumerator.js";
import type {
  ActionCandidate,
  HardPolicy,
  ActionPreview,
  AvailableAction,
  CanonicalSimulationStep,
  Plan,
  PlannerComposable,
  PlannerRuntime,
  SelectedAction,
  StrategyContext,
  WithPlannerConfig,
  PlannerGovernedComposable,
  SimulationResult,
  RawPlan,
} from "./runtime-types.js";

export function withPlanner<
  T extends ManifestoDomainShape,
  PK extends string = string,
  TermK extends string = string,
>(
  manifesto: PlannerGovernedComposable<T>,
  config: WithPlannerConfig<T, PK, TermK>,
): PlannerComposable<T, TermK> {
  assertComposableNotActivated(manifesto);

  const createKernel = getRuntimeKernelFactory(manifesto);

  return freezeValue({
    activate() {
      validatePlannerCompatibility(config);

      const hardPolicy = freezeHardPolicy(config.hardPolicy);
      const governed = manifesto.activate() as GovernanceInstance<T>;
      return createPlannerRuntime(governed, createKernel, config, hardPolicy);
    },
  }) as PlannerComposable<T, TermK>;
}

function createPlannerRuntime<
  T extends ManifestoDomainShape,
  PK extends string,
  TermK extends string,
>(
  governed: GovernanceInstance<T>,
  createKernel: () => RuntimeKernel<T>,
  config: WithPlannerConfig<T, PK, TermK>,
  hardPolicy: Readonly<Required<HardPolicy>>,
): GovernanceInstance<T> & PlannerRuntime<T, TermK> {
  const runtime: PlannerRuntime<T, TermK> = {
    preview<K extends keyof T["actions"] & string>(
      actionRef: TypedActionRef<T, K>,
      ...args: CreateIntentArgs<T, K>
    ): ActionPreview<T, TermK> {
      const kernel = createKernel();
      try {
        const rootSnapshot = governed.getCanonicalSnapshot();
        const intent = governed.createIntent(actionRef, ...args);
        const simulated = kernel.simulateSync(rootSnapshot, intent);
        const parameters = getPlannerInternals(config.planner).getParametersSnapshot();
        const evaluator = getPlannerInternals(config.planner);
        const previewAction = freezeValue({
          actionName: actionRef.name,
          input: intent.input,
          candidateId: intent.intentId,
        }) as AvailableAction<T>;
        const step = freezeValue({
          action: previewAction,
          snapshotBefore: rootSnapshot,
          snapshotAfter: simulated.snapshot,
          patches: simulated.patches,
          depth: 1,
        }) as CanonicalSimulationStep<T>;

        return freezeValue({
          snapshotAfter: projectSnapshot(kernel, simulated.snapshot),
          patches: simulated.patches,
          status: simulated.status,
          pendingRequirements: simulated.requirements,
          evaluation: evaluator.evaluateCanonical(
            Object.freeze([step]),
            simulated.snapshot,
            (snapshot) => projectSnapshot(kernel, snapshot),
            parameters,
          ),
          intent,
        }) as ActionPreview<T, TermK>;
      } finally {
        kernel.dispose();
      }
    },
    async plan(options): Promise<Plan<T, TermK>> {
      const kernel = createKernel();
      try {
        const rootSnapshot = governed.getCanonicalSnapshot();
        const parameterSnapshot = getPlannerInternals(config.planner).getParametersSnapshot();
        const intentByCandidateId = new Map<string, TypedIntent<T>>();
        const rawEnumerator = config.enumerator ?? createCoreEnumerator<T>();
        const plannerInternals = getPlannerInternals(config.planner);
        const clampedOptions = clampPlanOptions(options, hardPolicy);

        const enumerateRaw = (
          snapshot: CanonicalSnapshot<T["state"]>,
        ): readonly ActionCandidate<T>[] => {
          if (isCoreEnumerator(rawEnumerator)) {
            return Object.freeze(
              kernel
                .getAvailableActionsFor(snapshot)
                .filter((name) => isCandidateActionAvailable(
                  kernel,
                  snapshot,
                  name as keyof T["actions"] & string,
                ))
                .map((actionName) => freezeValue({
                  actionName: actionName as keyof T["actions"] & string,
                }) as ActionCandidate<T>),
            );
          }

          return Object.freeze(
            rawEnumerator
              .enumerate(snapshot)
              .filter((candidate) => isCandidateActionAvailable(kernel, snapshot, candidate.actionName))
              .map((candidate) => freezeValue({
                actionName: candidate.actionName,
                input: candidate.input,
                metadata: candidate.metadata,
              }) as ActionCandidate<T>),
          );
        };

        const strategyContext: StrategyContext<T, TermK> = freezeValue({
          currentSnapshot: rootSnapshot,
          hardPolicy,
          options: clampedOptions,
          simulator: {
            step(
              snapshot,
              action,
            ): SimulationResult<T> {
              const intent = intentByCandidateId.get(action.candidateId);
              if (!intent) {
                throw new ManifestoError(
                  "PLANNER_INTENT_MISSING",
                  `Planner runtime could not resolve intent for candidate "${action.candidateId}"`,
                );
              }

              const simulated = kernel.simulateSync(snapshot, intent);
              return freezeValue({
                snapshot: simulated.snapshot,
                status: simulated.status,
                patches: simulated.patches,
                pendingRequirements: simulated.requirements,
              }) as SimulationResult<T>;
            },
          },
          enumerator: {
            enumerate(snapshot) {
              return Object.freeze(
                enumerateRaw(snapshot).map((candidate) => {
                  const candidateId = createCandidateId();
                  const intent = createIntentForCandidate(governed, candidate);
                  intentByCandidateId.set(candidateId, intent);
                  return freezeValue({
                    actionName: candidate.actionName,
                    input: candidate.input,
                    metadata: candidate.metadata,
                    candidateId,
                  }) as AvailableAction<T>;
                }),
              );
            },
          },
          evaluator: {
            evaluate(trajectory, finalSnapshot) {
              return plannerInternals.evaluateCanonical(
                trajectory,
                finalSnapshot,
                (snapshot) => projectSnapshot(kernel, snapshot),
                parameterSnapshot,
              );
            },
          },
        }) as StrategyContext<T, TermK>;

        const rawPlan = await config.strategy.run(strategyContext);
        return projectPlan(
          rawPlan,
          intentByCandidateId,
          (snapshot) => projectSnapshot(kernel, snapshot),
        );
      } finally {
        kernel.dispose();
      }
    },
  };

  return freezeValue({
    ...governed,
    ...runtime,
  }) as GovernanceInstance<T> & PlannerRuntime<T, TermK>;
}

function validatePlannerCompatibility<
  T extends ManifestoDomainShape,
  PK extends string,
  TermK extends string,
>(
  config: WithPlannerConfig<T, PK, TermK>,
): void {
  if (config.planner.definedTerms.length === 0) {
    throw new PlannerActivationError(
      "Planner must define at least one term before activation",
    );
  }

  const definedTerms = new Set<string>(config.planner.definedTerms);
  const missing = config.strategy.requiredTerms.filter((term) => !definedTerms.has(term));
  if (missing.length > 0) {
    throw new PlannerActivationError(
      `Strategy requires undefined planner terms: ${missing.join(", ")}`,
    );
  }
}

function createIntentForCandidate<T extends ManifestoDomainShape>(
  governed: GovernanceInstance<T>,
  candidate: ActionCandidate<T>,
): TypedIntent<T> {
  const maybeActionRef = governed.MEL.actions[candidate.actionName];
  if (!maybeActionRef) {
    throw new ManifestoError(
      "PLANNER_UNKNOWN_ACTION",
      `Planner enumerator returned unknown action "${String(candidate.actionName)}"`,
    );
  }

  const createIntent = governed.createIntent as (
    action: TypedActionRef<T, keyof T["actions"] & string>,
    ...args: readonly unknown[]
  ) => TypedIntent<T>;
  const actionRef = maybeActionRef as TypedActionRef<
    T,
    keyof T["actions"] & string
  >;

  if (candidate.input === undefined) {
    return createIntent(actionRef);
  }

  return createIntent(actionRef, candidate.input);
}

function isCandidateActionAvailable<T extends ManifestoDomainShape>(
  kernel: RuntimeKernel<T>,
  snapshot: CanonicalSnapshot<T["state"]>,
  actionName: keyof T["actions"] & string,
): boolean {
  try {
    return kernel.isActionAvailableFor(snapshot, actionName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ManifestoError(
      "PLANNER_UNKNOWN_ACTION",
      `Planner enumerator returned unknown action "${String(actionName)}": ${message}`,
      { cause: error instanceof Error ? error : undefined },
    );
  }
}

function projectSnapshot<T extends ManifestoDomainShape>(
  kernel: RuntimeKernel<T>,
  snapshot: CanonicalSnapshot<T["state"]>,
): Snapshot<T["state"]> {
  kernel.setVisibleSnapshot(snapshot as CoreSnapshot, { notify: false });
  return kernel.getSnapshot();
}

function projectPlan<
  T extends ManifestoDomainShape,
  TermK extends string,
>(
  rawPlan: RawPlan<T, TermK>,
  intentByCandidateId: ReadonlyMap<string, TypedIntent<T>>,
  projectSnapshotFn: (snapshot: CanonicalSnapshot<T["state"]>) => Snapshot<T["state"]>,
): Plan<T, TermK> {
  if (rawPlan.bestAction === null) {
    return freezeValue({
      bestAction: null,
      alternatives: Object.freeze([]),
      stats: rawPlan.stats,
    }) as Plan<T, TermK>;
  }

  const projectSelectedAction = (
    candidate: NonNullable<RawPlan<T, TermK>["bestAction"]>,
  ): SelectedAction<T, TermK> => {
    const intent = intentByCandidateId.get(candidate.candidateId);
    if (!intent) {
      throw new ManifestoError(
        "PLANNER_INTENT_MISSING",
        `Planner runtime could not recover intent for candidate "${candidate.candidateId}"`,
      );
    }

    return freezeValue({
      actionName: candidate.actionName,
      input: candidate.input,
      intent,
      evaluation: candidate.evaluation,
      trajectory: Object.freeze(
        candidate.trajectory.map((step) => toProjectedStep(step, projectSnapshotFn)),
      ),
      confidence: candidate.confidence,
    }) as SelectedAction<T, TermK>;
  };

  const bestAction = projectSelectedAction(rawPlan.bestAction);
  const alternatives = Object.freeze(
    rawPlan.alternatives
      .filter((candidate) => candidate.candidateId !== rawPlan.bestAction?.candidateId)
      .map(projectSelectedAction),
  );

  return freezeValue({
    bestAction,
    alternatives,
    stats: rawPlan.stats,
  }) as Plan<T, TermK>;
}
