import type {
  CanonicalSnapshot,
  ManifestoDomainShape,
} from "@manifesto-ai/sdk";

import {
  createDeterministicRandom,
  freezeValue,
  stableStringify,
} from "./internal.js";
import type {
  AvailableAction,
  CanonicalSimulationStep,
  EvaluationResult,
  MctsStrategyConfig,
  PlanStats,
  RawPlan,
  Strategy,
  StrategyContext,
} from "./runtime-types.js";

type TreeNode<
  T extends ManifestoDomainShape,
  TermK extends string,
> = {
  readonly snapshot: CanonicalSnapshot<T["state"]>;
  readonly depth: number;
  readonly parent: TreeNode<T, TermK> | null;
  readonly incomingStep: CanonicalSimulationStep<T> | null;
  readonly children: TreeNode<T, TermK>[];
  pendingActions: AvailableAction<T>[] | null;
  isTerminal: boolean;
  visits: number;
  rewardSum: number;
  bestReward: number;
  bestEvaluation: EvaluationResult<TermK> | null;
  bestTrajectory: readonly CanonicalSimulationStep<T>[] | null;
};

type IterationResult<
  T extends ManifestoDomainShape,
  TermK extends string,
> = {
  readonly expansions: number;
  readonly maxDepthReached: number;
  readonly interruptedBy:
    | Extract<PlanStats["terminationReason"], "budget_exhausted" | "signal_aborted" | "timeout">
    | null;
  readonly trajectory: readonly CanonicalSimulationStep<T>[];
  readonly evaluation: EvaluationResult<TermK>;
};

const DEFAULT_MCTS_BUDGET = 1000;
const DEFAULT_MCTS_EXPLORATION = Math.SQRT2;

export function mctsStrategy<
  T extends ManifestoDomainShape = ManifestoDomainShape,
  TermK extends string = string,
>(
  config: MctsStrategyConfig<TermK>,
): Strategy<T, TermK> {
  const requiredTerms = Object.freeze([config.useTerm]) as readonly TermK[];
  const configuredBudget = normalizeBudget(config.budget);
  const exploration = normalizeExploration(config.exploration);

  return freezeValue({
    name: "mcts",
    requiredTerms,
    async run(context) {
      const startedAt = Date.now();
      const iterationBudget = Math.min(
        context.options.budgetOverride ?? configuredBudget,
        context.hardPolicy.maxExpansions,
      );
      const depthLimit = context.options.depthOverride ?? context.hardPolicy.maxDepth;
      const root = createTreeNode<T, TermK>({
        snapshot: context.currentSnapshot,
        depth: 0,
        parent: null,
        incomingStep: null,
      });
      const rng = createDeterministicRandom(root.snapshot);

      const initialStopReason = getStopReason(context, startedAt);
      if (initialStopReason) {
        return createEmptyPlan<T, TermK>(initialStopReason, startedAt);
      }

      enumerateNode(root, context);
      if ((root.pendingActions?.length ?? 0) === 0) {
        root.isTerminal = true;
        return createEmptyPlan<T, TermK>("no_actions", startedAt);
      }

      if (iterationBudget === 0 || depthLimit === 0) {
        return createEmptyPlan<T, TermK>("budget_exhausted", startedAt);
      }

      let iterations = 0;
      let expansions = 0;
      let maxDepthReached = 0;
      let terminationReason: PlanStats["terminationReason"] = "completed";

      while (iterations < iterationBudget) {
        const stopReason = getStopReason(context, startedAt);
        if (stopReason) {
          terminationReason = stopReason;
          break;
        }

        if (!hasSearchFrontier(root, depthLimit)) {
          terminationReason = "completed";
          break;
        }

        const iteration = executeIteration(
          root,
          context,
          config.useTerm,
          exploration,
          depthLimit,
          rng,
          startedAt,
        );

        expansions += iteration.expansions;
        maxDepthReached = Math.max(maxDepthReached, iteration.maxDepthReached);
        iterations += 1;

        if (iteration.interruptedBy) {
          terminationReason = iteration.interruptedBy;
          break;
        }

        if (expansions >= context.hardPolicy.maxExpansions) {
          terminationReason = "budget_exhausted";
          break;
        }
      }

      if (terminationReason === "completed" && iterations >= iterationBudget) {
        terminationReason = "budget_exhausted";
      }

      const ranked = root.children
        .map((child) => toRankedCandidate(child, root.visits, config.useTerm))
        .filter((candidate) => candidate !== null)
        .sort((left, right) => {
          if (right.visits !== left.visits) {
            return right.visits - left.visits;
          }

          const scoreDelta = right.evaluation.terms[config.useTerm]
            - left.evaluation.terms[config.useTerm];
          if (scoreDelta !== 0) {
            return scoreDelta;
          }

          return left.signature.localeCompare(right.signature);
        });

      const best = ranked[0]
        ? freezeValue({
          actionName: ranked[0].actionName,
          input: ranked[0].input,
          candidateId: ranked[0].candidateId,
          evaluation: ranked[0].evaluation,
          trajectory: ranked[0].trajectory,
          confidence: ranked[0].confidence,
        }) as NonNullable<RawPlan<T, TermK>["bestAction"]>
        : null;

      const alternatives = Object.freeze(
        ranked.slice(1).map((candidate) => freezeValue({
          actionName: candidate.actionName,
          input: candidate.input,
          candidateId: candidate.candidateId,
          evaluation: candidate.evaluation,
          trajectory: candidate.trajectory,
          confidence: candidate.confidence,
        }) as NonNullable<RawPlan<T, TermK>["bestAction"]>),
      );

      return freezeValue({
        bestAction: best,
        alternatives,
        stats: {
          expansions,
          maxDepthReached,
          elapsedMs: Date.now() - startedAt,
          pruned: 0,
          terminationReason: best === null && terminationReason === "completed"
            ? "no_actions"
            : terminationReason,
        },
      }) as RawPlan<T, TermK>;
    },
  }) as Strategy<T, TermK>;
}

function executeIteration<
  T extends ManifestoDomainShape,
  TermK extends string,
>(
  root: TreeNode<T, TermK>,
  context: StrategyContext<T, TermK>,
  useTerm: TermK,
  exploration: number,
  depthLimit: number,
  rng: () => number,
  startedAt: number,
): IterationResult<T, TermK> {
  const pathNodes: TreeNode<T, TermK>[] = [root];
  const trajectory: CanonicalSimulationStep<T>[] = [];
  let expansions = 0;
  let maxDepthReached = 0;
  let node = root;
  let interruptedBy: IterationResult<T, TermK>["interruptedBy"] = null;

  while (node.depth < depthLimit && !node.isTerminal) {
    interruptedBy = getStopReason(context, startedAt);
    if (interruptedBy) {
      break;
    }

    enumerateNode(node, context);

    if ((node.pendingActions?.length ?? 0) > 0) {
      if (expansions >= context.hardPolicy.maxExpansions) {
        interruptedBy = "budget_exhausted";
        break;
      }

      const action = node.pendingActions!.shift()!;
      const result = context.simulator.step(node.snapshot, action);
      expansions += 1;

      const step = freezeValue({
        action,
        snapshotBefore: node.snapshot,
        snapshotAfter: result.snapshot,
        patches: result.patches,
        depth: node.depth + 1,
      }) as CanonicalSimulationStep<T>;
      const child = createTreeNode<T, TermK>({
        snapshot: result.snapshot,
        depth: node.depth + 1,
        parent: node,
        incomingStep: step,
      });

      if (result.status !== "complete") {
        child.isTerminal = true;
      }

      node.children.push(child);
      node = child;
      pathNodes.push(child);
      trajectory.push(step);
      maxDepthReached = Math.max(maxDepthReached, step.depth);
      break;
    }

    if (node.children.length === 0) {
      node.isTerminal = true;
      break;
    }

    node = selectChild(node, exploration);
    pathNodes.push(node);
    if (node.incomingStep) {
      trajectory.push(node.incomingStep);
      maxDepthReached = Math.max(maxDepthReached, node.incomingStep.depth);
    }
  }

  let currentSnapshot = node.snapshot;
  let currentDepth = node.depth;

  while (!node.isTerminal && currentDepth < depthLimit) {
    interruptedBy = getStopReason(context, startedAt);
    if (interruptedBy) {
      break;
    }

    if (expansions >= context.hardPolicy.maxExpansions) {
      interruptedBy = "budget_exhausted";
      break;
    }

    const candidates = context.enumerator.enumerate(currentSnapshot);
    if (candidates.length === 0) {
      break;
    }

    const action = candidates[Math.floor(rng() * candidates.length)] ?? candidates[0];
    if (!action) {
      break;
    }

    const result = context.simulator.step(currentSnapshot, action);
    expansions += 1;
    currentDepth += 1;

    const step = freezeValue({
      action,
      snapshotBefore: currentSnapshot,
      snapshotAfter: result.snapshot,
      patches: result.patches,
      depth: currentDepth,
    }) as CanonicalSimulationStep<T>;
    trajectory.push(step);
    maxDepthReached = Math.max(maxDepthReached, currentDepth);
    currentSnapshot = result.snapshot;

    if (result.status !== "complete") {
      break;
    }
  }

  const frozenTrajectory = Object.freeze([...trajectory]) as readonly CanonicalSimulationStep<T>[];
  const evaluation = context.evaluator.evaluate(frozenTrajectory, currentSnapshot);
  const reward = evaluation.terms[useTerm];

  for (const pathNode of pathNodes) {
    pathNode.visits += 1;
    pathNode.rewardSum += reward;
    if (shouldReplaceBest(pathNode.bestReward, reward, pathNode.bestTrajectory, frozenTrajectory)) {
      pathNode.bestReward = reward;
      pathNode.bestEvaluation = evaluation;
      pathNode.bestTrajectory = frozenTrajectory;
    }
  }

  return {
    expansions,
    maxDepthReached,
    interruptedBy,
    trajectory: frozenTrajectory,
    evaluation,
  };
}

function createTreeNode<
  T extends ManifestoDomainShape,
  TermK extends string,
>(
  input: Pick<TreeNode<T, TermK>, "snapshot" | "depth" | "parent" | "incomingStep">,
): TreeNode<T, TermK> {
  return {
    snapshot: input.snapshot,
    depth: input.depth,
    parent: input.parent,
    incomingStep: input.incomingStep,
    children: [],
    pendingActions: null,
    isTerminal: false,
    visits: 0,
    rewardSum: 0,
    bestReward: Number.NEGATIVE_INFINITY,
    bestEvaluation: null,
    bestTrajectory: null,
  };
}

function enumerateNode<
  T extends ManifestoDomainShape,
  TermK extends string,
>(
  node: TreeNode<T, TermK>,
  context: StrategyContext<T, TermK>,
): void {
  if (node.pendingActions !== null || node.isTerminal) {
    return;
  }

  node.pendingActions = [...context.enumerator.enumerate(node.snapshot)];
  if (node.pendingActions.length === 0) {
    node.isTerminal = true;
  }
}

function hasSearchFrontier<
  T extends ManifestoDomainShape,
  TermK extends string,
>(
  node: TreeNode<T, TermK>,
  depthLimit: number,
): boolean {
  if (node.isTerminal || node.depth >= depthLimit) {
    return false;
  }

  if (node.pendingActions === null || node.pendingActions.length > 0) {
    return true;
  }

  return node.children.some((child) => hasSearchFrontier(child, depthLimit));
}

function selectChild<
  T extends ManifestoDomainShape,
  TermK extends string,
>(
  node: TreeNode<T, TermK>,
  exploration: number,
): TreeNode<T, TermK> {
  let bestChild = node.children[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  const parentVisits = Math.max(node.visits, 1);

  for (const child of node.children) {
    if (!bestChild) {
      bestChild = child;
    }

    const averageReward = child.visits === 0 ? 0 : child.rewardSum / child.visits;
    const explorationBonus = child.visits === 0
      ? Number.POSITIVE_INFINITY
      : exploration * Math.sqrt(Math.log(parentVisits) / child.visits);
    const score = averageReward + explorationBonus;

    if (score > bestScore) {
      bestScore = score;
      bestChild = child;
      continue;
    }

    if (score === bestScore && bestChild && compareNodes(child, bestChild) < 0) {
      bestChild = child;
    }
  }

  if (!bestChild) {
    throw new Error("MCTS selection requires at least one child");
  }

  return bestChild;
}

function compareNodes<
  T extends ManifestoDomainShape,
  TermK extends string,
>(
  left: TreeNode<T, TermK>,
  right: TreeNode<T, TermK>,
): number {
  return getNodeSignature(left).localeCompare(getNodeSignature(right));
}

function getNodeSignature<
  T extends ManifestoDomainShape,
  TermK extends string,
>(
  node: TreeNode<T, TermK>,
): string {
  if (!node.incomingStep) {
    return "root";
  }

  return stableStringify([
    node.incomingStep.action.actionName,
    node.incomingStep.action.input ?? null,
    node.incomingStep.action.metadata ?? null,
  ]);
}

function getStopReason<
  T extends ManifestoDomainShape,
  TermK extends string,
>(
  context: StrategyContext<T, TermK>,
  startedAt: number,
): Extract<PlanStats["terminationReason"], "signal_aborted" | "timeout"> | null {
  if (context.options.signal?.aborted) {
    return "signal_aborted";
  }

  if (Date.now() - startedAt >= context.hardPolicy.timeoutMs) {
    return "timeout";
  }

  return null;
}

function toRankedCandidate<
  T extends ManifestoDomainShape,
  TermK extends string,
>(
  child: TreeNode<T, TermK>,
  rootVisits: number,
  useTerm: TermK,
): (NonNullable<RawPlan<T, TermK>["bestAction"]> & {
  readonly visits: number;
  readonly signature: string;
}) | null {
  if (!child.incomingStep || !child.bestEvaluation || !child.bestTrajectory) {
    return null;
  }

  const signature = getNodeSignature(child);
  return freezeValue({
    actionName: child.incomingStep.action.actionName,
    input: child.incomingStep.action.input,
    candidateId: child.incomingStep.action.candidateId,
    evaluation: child.bestEvaluation,
    trajectory: child.bestTrajectory,
    confidence: rootVisits === 0 ? 0 : child.visits / rootVisits,
    visits: child.visits,
    signature,
    score: child.bestEvaluation.terms[useTerm],
  }) as NonNullable<RawPlan<T, TermK>["bestAction"]> & {
    readonly visits: number;
    readonly signature: string;
    readonly score: number;
  };
}

function shouldReplaceBest<
  T extends ManifestoDomainShape,
>(
  currentReward: number,
  nextReward: number,
  currentTrajectory: readonly CanonicalSimulationStep<T>[] | null,
  nextTrajectory: readonly CanonicalSimulationStep<T>[],
): boolean {
  if (nextReward > currentReward) {
    return true;
  }

  if (nextReward < currentReward) {
    return false;
  }

  if (currentTrajectory === null) {
    return true;
  }

  if (nextTrajectory.length !== currentTrajectory.length) {
    return nextTrajectory.length < currentTrajectory.length;
  }

  return stableStringify(nextTrajectory).localeCompare(stableStringify(currentTrajectory)) < 0;
}

function createEmptyPlan<
  T extends ManifestoDomainShape,
  TermK extends string,
>(
  terminationReason: PlanStats["terminationReason"],
  startedAt: number,
): RawPlan<T, TermK> {
  return freezeValue({
    bestAction: null,
    alternatives: Object.freeze([]),
    stats: {
      expansions: 0,
      maxDepthReached: 0,
      elapsedMs: Date.now() - startedAt,
      pruned: 0,
      terminationReason,
    },
  }) as RawPlan<T, TermK>;
}

function normalizeBudget(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) {
    return DEFAULT_MCTS_BUDGET;
  }

  return Math.max(0, Math.floor(value));
}

function normalizeExploration(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) {
    return DEFAULT_MCTS_EXPLORATION;
  }

  return Math.max(0, value);
}
