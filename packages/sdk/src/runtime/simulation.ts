import {
  apply,
  applySystemDelta,
  computeSync,
  type DomainSchema,
  type Snapshot as CoreSnapshot,
  type TraceGraph,
} from "@manifesto-ai/core";
import {
  getHostState,
  type HostContextProvider,
  type IntentSlot,
} from "@manifesto-ai/host";

import {
  ManifestoError,
} from "../errors.js";
import {
  cloneAndDeepFreeze,
} from "../projection/snapshot-projection.js";
import type {
  CanonicalSnapshot,
  ManifestoDomainShape,
  TypedIntent,
} from "../types.js";
import type {
  IntentLegalityEvaluation,
  RuntimeSimulateSync,
  RuntimeSimulationResult,
} from "./facets.js";

type RuntimeSimulationOptions<T extends ManifestoDomainShape> = {
  readonly schema: DomainSchema;
  readonly hostContextProvider: HostContextProvider;
  readonly evaluateIntentLegalityFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ) => IntentLegalityEvaluation<T>;
};

function normalizeTraceNodeTimestamps(
  node: TraceGraph["root"],
  timestamp: number,
): TraceGraph["root"] {
  return {
    ...node,
    timestamp,
    children: node.children.map((child) =>
      normalizeTraceNodeTimestamps(child, timestamp)
    ),
  };
}

function createStableSimulationTrace(
  trace: TraceGraph,
  timestamp: number,
): TraceGraph {
  return {
    ...trace,
    duration: 0,
    root: normalizeTraceNodeTimestamps(trace.root, timestamp),
    nodes: Object.fromEntries(
      Object.entries(trace.nodes).map(([id, value]) => [
        id,
        {
          ...value,
          timestamp,
        },
      ]),
    ),
  };
}

export function createRuntimeSimulation<T extends ManifestoDomainShape>({
  schema,
  hostContextProvider,
  evaluateIntentLegalityFor,
}: RuntimeSimulationOptions<T>) {
  function withHostIntentSlot(
    snapshot: CoreSnapshot,
    intent: TypedIntent<T>,
    context: ReturnType<HostContextProvider["createFrozenContext"]>,
  ): CoreSnapshot {
    const hostState = getHostState(snapshot.data);
    const intentSlots = hostState?.intentSlots ?? {};
    const intentSlot: IntentSlot = intent.input === undefined
      ? { type: intent.type }
      : { type: intent.type, input: intent.input };

    return apply(
      schema,
      snapshot,
      [
        {
          op: "merge",
          path: [{ kind: "prop", name: "$host" }],
          value: {
            intentSlots: {
              ...intentSlots,
              [intent.intentId]: intentSlot,
            },
          },
        },
      ],
      context,
    );
  }

  function createSimulationUnavailableError(intent: TypedIntent<T>): ManifestoError {
    return new ManifestoError(
      "ACTION_UNAVAILABLE",
      `Action "${intent.type}" is unavailable against the provided canonical snapshot`,
    );
  }

  function createSimulationNotDispatchableError(intent: TypedIntent<T>): ManifestoError {
    return new ManifestoError(
      "INTENT_NOT_DISPATCHABLE",
      `Action "${intent.type}" is available, but the bound intent is not dispatchable against the provided canonical snapshot`,
    );
  }

  const simulateSync: RuntimeSimulateSync<T> = (
    snapshot,
    intent,
  ): RuntimeSimulationResult<T> => {
    const legality = evaluateIntentLegalityFor(snapshot, intent);
    if (legality.kind === "unavailable") {
      throw createSimulationUnavailableError(legality.intent);
    }
    if (legality.kind === "invalid-input") {
      throw legality.error;
    }
    if (legality.kind === "not-dispatchable") {
      throw createSimulationNotDispatchableError(legality.intent);
    }
    const enrichedIntent = legality.intent;

    const context = hostContextProvider.createFrozenContext(enrichedIntent.intentId);
    const baseline = withHostIntentSlot(
      structuredClone(snapshot as CoreSnapshot),
      enrichedIntent,
      context,
    );
    const result = computeSync(schema, baseline, enrichedIntent, context);
    const afterPatches = apply(schema, baseline, result.patches, context);
    const canonicalSimulated = applySystemDelta(afterPatches, result.systemDelta);

    return Object.freeze({
      snapshot: cloneAndDeepFreeze(
        canonicalSimulated as CanonicalSnapshot<T["state"]>,
      ),
      patches: cloneAndDeepFreeze(result.patches),
      systemDelta: cloneAndDeepFreeze(result.systemDelta),
      status: result.status,
      requirements: cloneAndDeepFreeze(result.systemDelta.addRequirements),
      diagnostics: Object.freeze({
        trace: cloneAndDeepFreeze(
          createStableSimulationTrace(result.trace, snapshot.meta.timestamp),
        ),
      }),
    }) as RuntimeSimulationResult<T>;
  };

  return Object.freeze({
    withHostIntentSlot,
    createSimulationUnavailableError,
    createSimulationNotDispatchableError,
    simulateSync,
  });
}
