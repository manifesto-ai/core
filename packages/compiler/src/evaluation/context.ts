/**
 * Evaluation Context Types
 *
 * Defines context for expression evaluation.
 *
 * @see SPEC v0.4.0 §18.3
 */

/**
 * Minimal snapshot shape for evaluation.
 *
 * @see SPEC v0.4.0 §18.7
 */
export interface EvaluationSnapshot {
  /**
   * Domain data (matches StateSpec).
   * Path resolution default target.
   */
  data: unknown;

  /**
   * Computed values (matches ComputedSpec).
   * Accessed via "computed.*" paths.
   */
  computed: Record<string, unknown>;
}

/**
 * Intent metadata for evaluation.
 *
 * @see SPEC v0.4.0 §18.3
 */
export interface EvaluationMeta {
  /**
   * Intent identifier.
   */
  intentId: string;

  /**
   * Actor reference (optional).
   */
  actor?: {
    type: string;
    id: string;
  };

  /**
   * Timestamp (optional).
   */
  timestamp?: number;
}

/**
 * Evaluation context.
 *
 * @see SPEC v0.4.0 §18.3
 */
export interface EvaluationContext {
  /**
   * Current snapshot for state lookups.
   * Paths resolve to snapshot.data.* by default.
   */
  snapshot: EvaluationSnapshot;

  /**
   * Intent metadata.
   * Paths starting with "meta.*" resolve here.
   */
  meta: EvaluationMeta;

  /**
   * Intent input.
   * Paths starting with "input.*" resolve here.
   */
  input: Record<string, unknown>;

  /**
   * Current $item value (for effect.args evaluation).
   * Paths starting with "$item.*" resolve here.
   */
  item?: unknown;
}

/**
 * Create a minimal evaluation context.
 *
 * @param options - Context options
 * @returns Evaluation context
 */
export function createEvaluationContext(
  options: Partial<EvaluationContext> & { meta: EvaluationMeta }
): EvaluationContext {
  return {
    snapshot: options.snapshot ?? { data: {}, computed: {} },
    meta: options.meta,
    input: options.input ?? {},
    item: options.item,
  };
}

/**
 * Create a working snapshot by cloning and applying a patch.
 *
 * Used for sequential evaluation semantics.
 *
 * @see FDR-MEL-070
 */
export function applyPatchToWorkingSnapshot(
  snapshot: EvaluationSnapshot,
  path: string,
  value: unknown
): EvaluationSnapshot {
  // Deep clone data
  const newData = structuredClone(snapshot.data) as Record<string, unknown>;

  // Apply patch at path
  setValueAtPath(newData, path, value);

  return {
    data: newData,
    computed: snapshot.computed,
  };
}

/**
 * Set value at a dot-separated path.
 *
 * @param obj - Target object
 * @param path - Dot-separated path (e.g., "user.name")
 * @param value - Value to set
 */
function setValueAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}
