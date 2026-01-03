import type {
  ManifestoCore,
  DomainSchema,
  Snapshot,
  Intent,
  ComputeResult,
  TraceGraph,
  Patch,
  Requirement,
  HostContext,
} from "@manifesto-ai/core";
import { createError } from "@manifesto-ai/core";
import type { EffectExecutor } from "./effects/executor.js";
import { createHostError, HostError } from "./errors.js";
import { createHostContextBuilder, type HostContextOptions } from "./context.js";

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
   * Optional approved scope for enforcement (opaque to Host by default)
   */
  approvedScope?: unknown;

  /**
   * Called before each compute call
   */
  onBeforeCompute?: (iteration: number, snapshot: Snapshot) => void | Promise<void>;

  /**
   * Called after each compute call
   */
  onAfterCompute?: (iteration: number, result: ComputeResult) => void | Promise<void>;

  /**
   * Called before effect execution
   */
  onBeforeEffect?: (requirement: Requirement) => void | Promise<void>;

  /**
   * Called after effect execution
   */
  onAfterEffect?: (requirement: Requirement, patches: Patch[], error?: string) => void | Promise<void>;

  /**
   * Called after patches are applied
   */
  onAfterApply?: (
    source: "effect",
    patches: Patch[],
    before: Snapshot,
    after: Snapshot
  ) => void | Promise<void>;

  /**
   * Host context providers for deterministic inputs
   */
  context?: HostContextOptions;
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
  const getContext = createHostContextBuilder(intent, options.context);

  let currentSnapshot = snapshot;
  let iteration = 0;

  const executeRequirements = async (
    requirements: Requirement[],
    snapshotState: Snapshot
  ): Promise<{ snapshot: Snapshot; shouldRecompute: boolean }> => {
    let workingSnapshot = snapshotState;
    let shouldRecompute = false;

    for (const requirement of requirements) {
      await options.onBeforeEffect?.(requirement);

      const effectResult = await executor.execute(requirement, workingSnapshot);

      await options.onAfterEffect?.(requirement, effectResult.patches, effectResult.error);

      if (!effectResult.success) {
        const context = getContext();
        const failurePatches = buildEffectFailurePatches(
          requirement,
          effectResult.error ?? "Effect execution failed",
          workingSnapshot,
          context
        );
        const beforeApply = workingSnapshot;
        workingSnapshot = core.apply(schema, workingSnapshot, failurePatches, context);
        await options.onAfterApply?.("effect", failurePatches, beforeApply, workingSnapshot);
        shouldRecompute = true;
        break;
      }

      const clearPatches = buildClearRequirementPatches(workingSnapshot, requirement);
      const appliedPatches = [...effectResult.patches, ...clearPatches];
      const beforeApply = workingSnapshot;
      workingSnapshot = core.apply(schema, workingSnapshot, appliedPatches, getContext());
      await options.onAfterApply?.("effect", appliedPatches, beforeApply, workingSnapshot);
    }

    return { snapshot: workingSnapshot, shouldRecompute };
  };

  if (!intent.intentId) {
    return {
      status: "error",
      snapshot: currentSnapshot,
      traces,
      iterations: iteration,
      error: createHostError(
        "INVALID_STATE",
        "Intent must have intentId",
        { intent }
      ),
    };
  }

  while (iteration < maxIterations) {
    iteration++;

    if (currentSnapshot.system.pendingRequirements.length > 0) {
      const clearPatches: Patch[] = [
        { op: "set", path: "system.pendingRequirements", value: [] },
        { op: "set", path: "system.status", value: "idle" },
      ];
      const beforeApply = currentSnapshot;
      currentSnapshot = core.apply(schema, currentSnapshot, clearPatches, getContext());
      await options.onAfterApply?.("effect", clearPatches, beforeApply, currentSnapshot);
    }

    // Notify before compute
    await options.onBeforeCompute?.(iteration, currentSnapshot);

    // 1. Call core.compute()
    const result = await core.compute(schema, currentSnapshot, intent, getContext());
    traces.push(result.trace);

    // Notify after compute
    await options.onAfterCompute?.(iteration, result);

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
      const requirementResult = await executeRequirements(
        result.requirements,
        result.snapshot
      );
      currentSnapshot = requirementResult.snapshot;

      if (requirementResult.shouldRecompute) {
        continue;
      }

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

function buildClearRequirementPatches(
  snapshot: Snapshot,
  requirement: Requirement,
  options?: { setIdle?: boolean }
): Patch[] {
  const remainingRequirements = snapshot.system.pendingRequirements.filter(
    (req) => req.id !== requirement.id
  );

  const patches: Patch[] = [
    { op: "set", path: "system.pendingRequirements", value: remainingRequirements },
  ];

  if (options?.setIdle !== false && remainingRequirements.length === 0) {
    patches.push({ op: "set", path: "system.status", value: "idle" });
  }

  return patches;
}

function buildEffectFailurePatches(
  requirement: Requirement,
  message: string,
  snapshot: Snapshot,
  context: HostContext
): Patch[] {
  const code = message.startsWith("Unknown effect type") ? "UNKNOWN_EFFECT" : "INTERNAL_ERROR";
  const error = createError(
    code,
    message,
    requirement.actionId,
    requirement.flowPosition.nodePath,
    context.now,
    { requirement }
  );

  return [
    { op: "set", path: "system.lastError", value: error },
    { op: "set", path: "system.errors", value: [...snapshot.system.errors, error] },
    { op: "set", path: "system.status", value: "error" },
    ...buildClearRequirementPatches(snapshot, requirement, { setIdle: false }),
  ];
}
