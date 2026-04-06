import type { ManifestoDomainShape } from "@manifesto-ai/sdk";

import { createGreedyConfidence, freezeValue } from "./internal.js";
import type {
  CanonicalSimulationStep,
  GreedyStrategyConfig,
  RawPlan,
  Strategy,
} from "./runtime-types.js";

export function greedyStrategy<
  T extends ManifestoDomainShape = ManifestoDomainShape,
  TermK extends string = string,
>(
  config: GreedyStrategyConfig<TermK>,
): Strategy<T, TermK> {
  const requiredTerms = Object.freeze([config.useTerm]) as readonly TermK[];

  return freezeValue({
    name: "greedy",
    requiredTerms,
    async run(context) {
      const startedAt = Date.now();
      const candidates = context.enumerator.enumerate(context.currentSnapshot);
      const hardLimit = context.hardPolicy.maxExpansions;
      const budgetLimit = context.options.budgetOverride ?? hardLimit;
      const evaluationLimit = Math.min(candidates.length, hardLimit, budgetLimit);
      const evaluated: Array<NonNullable<RawPlan<T, TermK>["bestAction"]>> = [];
      let terminationReason: RawPlan<T, TermK>["stats"]["terminationReason"] = "completed";

      if (candidates.length === 0) {
        return freezeValue({
          bestAction: null,
          alternatives: Object.freeze([]),
          stats: {
            expansions: 0,
            maxDepthReached: 0,
            elapsedMs: Date.now() - startedAt,
            pruned: 0,
            terminationReason: "no_actions",
          },
        }) as RawPlan<T, TermK>;
      }

      for (let index = 0; index < evaluationLimit; index += 1) {
        if (context.options.signal?.aborted) {
          terminationReason = "signal_aborted";
          break;
        }

        if (Date.now() - startedAt >= context.hardPolicy.timeoutMs) {
          terminationReason = "timeout";
          break;
        }

        const action = candidates[index];
        if (!action) {
          continue;
        }

        const result = context.simulator.step(context.currentSnapshot, action);
        const trajectory = Object.freeze([
          freezeValue({
            action,
            snapshotBefore: context.currentSnapshot,
            snapshotAfter: result.snapshot,
            patches: result.patches,
            depth: 1,
          }) as CanonicalSimulationStep<T>,
        ]) as readonly CanonicalSimulationStep<T>[];
        const evaluation = context.evaluator.evaluate(trajectory, result.snapshot);

        evaluated.push(freezeValue({
          actionName: action.actionName,
          input: action.input,
          candidateId: action.candidateId,
          evaluation,
          trajectory,
          confidence: 0,
        }) as NonNullable<RawPlan<T, TermK>["bestAction"]>);
      }

      if (
        terminationReason === "completed"
        && evaluationLimit < candidates.length
      ) {
        terminationReason = "budget_exhausted";
      }

      const sorted = [...evaluated].sort((left, right) => {
        return (
          right.evaluation.terms[config.useTerm]
          - left.evaluation.terms[config.useTerm]
        );
      });

      const best = sorted[0]
        ? freezeValue({
          ...sorted[0],
          confidence: createGreedyConfidence(
            sorted[0].evaluation.terms[config.useTerm],
            sorted[1]?.evaluation.terms[config.useTerm],
          ),
        }) as NonNullable<RawPlan<T, TermK>["bestAction"]>
        : null;

      return freezeValue({
        bestAction: best,
        alternatives: Object.freeze(sorted.slice(1)),
        stats: {
          expansions: evaluated.length,
          maxDepthReached: best ? 1 : 0,
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
