import type {
  ManifestoCore,
  DomainSchema,
  Snapshot,
  Intent,
  ComputeResult,
  TraceGraph,
  Patch,
  Requirement,
} from "@manifesto-ai/core";
import type { EffectExecutor } from "./effects/executor.js";
import { createHostError, HostError } from "./errors.js";

/**
 * Host loop result
 */
export interface HostLoopResult {
  /**
   * Final status
   */
  status: "complete" | "halted" | "error";

  /**
   * Final snapshot
   */
  snapshot: Snapshot;

  /**
   * Combined trace from all iterations
   */
  traces: TraceGraph[];

  /**
   * Total number of loop iterations
   */
  iterations: number;

  /**
   * Error if status is "error"
   */
  error?: HostError;
}

/**
 * Host loop options
 */
export interface HostLoopOptions {
  /**
   * Maximum number of iterations (default: 100)
   * Prevents infinite loops from runaway effects
   */
  maxIterations?: number;

  /**
   * Called before each compute call
   */
  onBeforeCompute?: (iteration: number, snapshot: Snapshot) => void;

  /**
   * Called after each compute call
   */
  onAfterCompute?: (iteration: number, result: ComputeResult) => void;

  /**
   * Called before effect execution
   */
  onBeforeEffect?: (requirement: Requirement) => void;

  /**
   * Called after effect execution
   */
  onAfterEffect?: (requirement: Requirement, patches: Patch[], error?: string) => void;
}

const DEFAULT_MAX_ITERATIONS = 100;

/**
 * Run the host loop
 *
 * The host loop implements the compute-effect-resume cycle:
 * 1. Call core.compute() with intent
 * 2. If status is "complete", "halted", or "error" -> return
 * 3. If status is "pending" -> execute effects, apply patches, resume
 *
 * @param core - ManifestoCore instance
 * @param schema - Domain schema
 * @param snapshot - Initial snapshot
 * @param intent - Intent to process
 * @param executor - Effect executor
 * @param options - Loop options
 */
export async function runHostLoop(
  core: ManifestoCore,
  schema: DomainSchema,
  snapshot: Snapshot,
  intent: Intent,
  executor: EffectExecutor,
  options: HostLoopOptions = {}
): Promise<HostLoopResult> {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const traces: TraceGraph[] = [];

  let currentSnapshot = snapshot;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    // Notify before compute
    options.onBeforeCompute?.(iteration, currentSnapshot);

    // 1. Call core.compute()
    const result = await core.compute(schema, currentSnapshot, intent);
    traces.push(result.trace);

    // Notify after compute
    options.onAfterCompute?.(iteration, result);

    // 2. Check terminal states
    if (result.status === "complete") {
      return {
        status: "complete",
        snapshot: result.snapshot,
        traces,
        iterations: iteration,
      };
    }

    if (result.status === "halted") {
      return {
        status: "halted",
        snapshot: result.snapshot,
        traces,
        iterations: iteration,
      };
    }

    if (result.status === "error") {
      return {
        status: "error",
        snapshot: result.snapshot,
        traces,
        iterations: iteration,
        error: createHostError(
          "EFFECT_EXECUTION_FAILED",
          result.snapshot.system.lastError?.message ?? "Unknown error",
          { lastError: result.snapshot.system.lastError }
        ),
      };
    }

    // 3. Status is "pending" - execute effects
    if (result.status === "pending") {
      const requirements = result.snapshot.system.pendingRequirements;

      // Check for missing handlers
      const missingHandlers = executor.getMissingHandlers(requirements);
      if (missingHandlers.length > 0) {
        return {
          status: "error",
          snapshot: result.snapshot,
          traces,
          iterations: iteration,
          error: createHostError(
            "UNKNOWN_EFFECT_TYPE",
            `Unknown effect types: ${missingHandlers.join(", ")}`,
            { missingHandlers }
          ),
        };
      }

      // Execute all effects
      const allPatches: Patch[] = [];

      for (const requirement of requirements) {
        options.onBeforeEffect?.(requirement);

        const effectResult = await executor.execute(requirement, result.snapshot);

        options.onAfterEffect?.(requirement, effectResult.patches, effectResult.error);

        if (!effectResult.success) {
          return {
            status: "error",
            snapshot: result.snapshot,
            traces,
            iterations: iteration,
            error: createHostError(
              "EFFECT_EXECUTION_FAILED",
              effectResult.error ?? "Effect execution failed",
              { requirement, error: effectResult.error }
            ),
          };
        }

        allPatches.push(...effectResult.patches);
      }

      // 4. Apply effect patches and clear requirements
      currentSnapshot = core.apply(schema, result.snapshot, allPatches);
      currentSnapshot = clearRequirements(currentSnapshot, requirements);

      // 5. Continue loop with same intentId (intent is unchanged)
    }
  }

  // Max iterations reached
  return {
    status: "error",
    snapshot: currentSnapshot,
    traces,
    iterations: iteration,
    error: createHostError(
      "LOOP_MAX_ITERATIONS",
      `Host loop exceeded maximum iterations (${maxIterations})`,
      { maxIterations }
    ),
  };
}

/**
 * Clear fulfilled requirements from snapshot
 */
function clearRequirements(
  snapshot: Snapshot,
  fulfilledRequirements: readonly Requirement[]
): Snapshot {
  const fulfilledIds = new Set(fulfilledRequirements.map((r) => r.id));

  const remainingRequirements = snapshot.system.pendingRequirements.filter(
    (r) => !fulfilledIds.has(r.id)
  );

  return {
    ...snapshot,
    system: {
      ...snapshot.system,
      pendingRequirements: remainingRequirements,
      status: remainingRequirements.length === 0 ? "idle" : snapshot.system.status,
    },
  };
}
