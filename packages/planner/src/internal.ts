import type {
  CanonicalSnapshot,
  ManifestoDomainShape,
  Snapshot,
} from "@manifesto-ai/sdk";

import type {
  ActionCandidate,
  AvailableAction,
  CanonicalSimulationStep,
  EvaluationResult,
  HardPolicy,
  PlanOptions,
  Planner,
  SimulationStep,
} from "./runtime-types.js";

const CORE_ENUMERATOR_MARKER = Symbol("manifesto-planner.core-enumerator");
const PLANNER_INTERNALS = Symbol("manifesto-planner.internals");

export type PlannerInternals<
  T extends ManifestoDomainShape,
  PK extends string,
  TermK extends string,
> = {
  readonly getParametersSnapshot: () => Readonly<Record<PK, number>>;
  readonly evaluateCanonical: (
    trajectory: readonly CanonicalSimulationStep<T>[],
    finalSnapshot: CanonicalSnapshot<T["state"]>,
    projectSnapshot: (snapshot: CanonicalSnapshot<T["state"]>) => Snapshot<T["state"]>,
    parameters: Readonly<Record<PK, number>>,
  ) => EvaluationResult<TermK>;
};

type MaybeCoreEnumerator = {
  readonly [CORE_ENUMERATOR_MARKER]?: true;
};

export function markCoreEnumerator<T extends object>(value: T): T {
  Object.defineProperty(value, CORE_ENUMERATOR_MARKER, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: true,
  });
  return value;
}

export function isCoreEnumerator(value: unknown): value is MaybeCoreEnumerator {
  return typeof value === "object"
    && value !== null
    && CORE_ENUMERATOR_MARKER in value;
}

export function attachPlannerInternals<
  T extends ManifestoDomainShape,
  PK extends string,
  TermK extends string,
>(
  planner: Planner<T, PK, TermK>,
  internals: PlannerInternals<T, PK, TermK>,
): void {
  Object.defineProperty(planner, PLANNER_INTERNALS, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: internals,
  });
}

export function getPlannerInternals<
  T extends ManifestoDomainShape,
  PK extends string,
  TermK extends string,
>(
  planner: Planner<T, PK, TermK>,
): PlannerInternals<T, PK, TermK> {
  return (planner as Planner<T, PK, TermK> & {
    readonly [PLANNER_INTERNALS]: PlannerInternals<T, PK, TermK>;
  })[PLANNER_INTERNALS];
}

export function toActionCandidate<T extends ManifestoDomainShape>(
  action: ActionCandidate<T> | AvailableAction<T>,
): ActionCandidate<T> {
  return freezeValue({
    actionName: action.actionName,
    input: action.input,
    metadata: action.metadata,
  }) as ActionCandidate<T>;
}

export function toProjectedStep<T extends ManifestoDomainShape>(
  step: CanonicalSimulationStep<T>,
  projectSnapshot: (snapshot: CanonicalSnapshot<T["state"]>) => Snapshot<T["state"]>,
): SimulationStep<T> {
  return freezeValue({
    action: toActionCandidate(step.action),
    snapshotBefore: projectSnapshot(step.snapshotBefore),
    snapshotAfter: projectSnapshot(step.snapshotAfter),
    patches: step.patches,
    depth: step.depth,
  }) as SimulationStep<T>;
}

export function freezeHardPolicy(policy?: HardPolicy): Readonly<Required<HardPolicy>> {
  return freezeValue({
    maxDepth: normalizePositiveInteger(policy?.maxDepth, 100),
    maxExpansions: normalizePositiveInteger(policy?.maxExpansions, 10_000),
    timeoutMs: normalizePositiveInteger(policy?.timeoutMs, 5_000),
  }) as Readonly<Required<HardPolicy>>;
}

export function clampPlanOptions(
  options: PlanOptions | undefined,
  hardPolicy: Readonly<Required<HardPolicy>>,
): Readonly<PlanOptions> {
  return freezeValue({
    budgetOverride: clampPositiveInteger(options?.budgetOverride, hardPolicy.maxExpansions),
    depthOverride: clampPositiveInteger(options?.depthOverride, hardPolicy.maxDepth),
    signal: options?.signal,
  }) as Readonly<PlanOptions>;
}

export function createCandidateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `candidate-${Math.random().toString(16).slice(2)}`;
}

export function defaultProjectCanonicalSnapshot<T>(
  snapshot: CanonicalSnapshot<T>,
): Snapshot<T> {
  const projectedData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot.data as Record<string, unknown>)) {
    if (!key.startsWith("$")) {
      projectedData[key] = value;
    }
  }

  return freezeValue({
    data: structuredClone(projectedData) as T,
    computed: structuredClone(snapshot.computed),
    system: {
      status: snapshot.system.status,
      lastError: structuredClone(snapshot.system.lastError),
    },
    meta: {
      schemaHash: snapshot.meta.schemaHash,
    },
  }) as Snapshot<T>;
}

export function createGreedyConfidence(bestScore: number, nextScore?: number): number {
  if (nextScore === undefined) {
    return 1;
  }

  const delta = bestScore - nextScore;
  const scale = Math.abs(bestScore) + Math.abs(nextScore) + 1;
  return Math.max(0, Math.min(1, delta / scale));
}

export function createDeterministicRandom(seedSource: unknown): () => number {
  let state = hashStringToUint32(stableStringify(seedSource));
  if (state === 0) {
    state = 0x6d2b79f5;
  }

  return () => {
    state += 0x6d2b79f5;
    let output = state;
    output = Math.imul(output ^ (output >>> 15), output | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
}

export function stableStringify(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(String(value));
}

export function freezeValue<T>(value: T): T {
  deepFreeze(value);
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => deepFreeze(entry));
    return Object.freeze(value) as T;
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry);
  }

  return Object.freeze(value);
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || value === undefined) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function clampPositiveInteger(value: number | undefined, ceiling: number): number | undefined {
  if (!Number.isFinite(value) || value === undefined) {
    return undefined;
  }

  return Math.max(0, Math.min(Math.floor(value), ceiling));
}

function hashStringToUint32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
