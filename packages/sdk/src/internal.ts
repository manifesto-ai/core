import {
  apply,
  applySystemDelta,
  computeSync,
  getAvailableActions as queryAvailableActions,
  isActionAvailable as queryActionAvailable,
  isIntentDispatchable as queryIntentDispatchable,
  type ComputeStatus,
  type DomainSchema,
  type Patch,
  type Requirement,
  type Snapshot as CoreSnapshot,
  type SystemDelta,
} from "@manifesto-ai/core";
import {
  extractSchemaGraph,
  type SchemaGraph as RawSchemaGraph,
} from "@manifesto-ai/compiler";
import type {
  HostContextProvider,
  HostResult,
  IntentSlot,
  ManifestoHost,
} from "@manifesto-ai/host";
import { getHostState } from "@manifesto-ai/host";

import {
  AlreadyActivatedError,
  DisposedError,
  ManifestoError,
} from "./errors.js";
import type {
  BaseLaws,
  CanonicalSnapshot,
  ComposableManifesto,
  DispatchBlocker,
  ManifestoBaseInstance,
  ManifestoDomainShape,
  ManifestoEvent,
  ManifestoEventMap,
  SchemaGraph,
  SchemaGraphNodeId,
  SchemaGraphNodeRef,
  Selector,
  SimulateResult as ProjectedSimulateResult,
  Snapshot,
  TypedActionMetadata,
  TypedCreateIntent,
  TypedGetActionMetadata,
  TypedGetIntentBlockers,
  TypedIntent,
  TypedIsIntentDispatchable,
  TypedMEL,
  TypedOn,
  TypedSimulate,
  TypedSubscribe,
  Unsubscribe,
} from "./types.js";
import {
  cloneAndDeepFreeze,
  projectCanonicalSnapshot,
  projectedSnapshotsEqual,
  type SnapshotProjectionPlan,
} from "./snapshot-projection.js";
import type {
  ExtensionKernel,
  ExtensionSimulateResult,
} from "./extensions-types.js";

export const ACTION_PARAM_NAMES = Symbol("manifesto-sdk.action-param-names");
export const RUNTIME_KERNEL_FACTORY = Symbol("manifesto-sdk.runtime-kernel-factory");
export const ACTIVATION_STATE = Symbol("manifesto-sdk.activation-state");
export const EXTENSION_KERNEL = Symbol("manifesto-sdk.extension-kernel");
const SCHEMA_GRAPH_NODE_ID_PATTERN = /^(state|computed|action):.+$/;

type RuntimeActionParamMetadata = readonly string[] | null;
type RuntimeActionRef = {
  readonly name: PropertyKey;
  readonly [ACTION_PARAM_NAMES]?: RuntimeActionParamMetadata;
};

export type ActivationState = {
  activated: boolean;
};

export type HostDispatchOptions = NonNullable<Parameters<ManifestoHost["dispatch"]>[1]>;

interface Subscriber<TState, R> {
  readonly selector: Selector<TState, R>;
  readonly listener: (value: R) => void;
  lastValue: R | undefined;
  initialized: boolean;
}

export type SimulateResult<
  T extends ManifestoDomainShape = ManifestoDomainShape,
> = {
  readonly snapshot: CanonicalSnapshot<T["state"]>;
  readonly patches: readonly Patch[];
  readonly systemDelta: Readonly<SystemDelta>;
  readonly status: ComputeStatus;
  readonly requirements: readonly Requirement[];
};

export interface RuntimeKernel<T extends ManifestoDomainShape> {
  readonly schema: DomainSchema;
  readonly MEL: TypedMEL<T>;
  readonly createIntent: TypedCreateIntent<T>;
  readonly subscribe: TypedSubscribe<T>;
  readonly on: TypedOn<T>;
  readonly getSnapshot: () => Snapshot<T["state"]>;
  readonly getCanonicalSnapshot: () => CanonicalSnapshot<T["state"]>;
  readonly getAvailableActionsFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
  ) => readonly (keyof T["actions"])[];
  readonly getAvailableActions: () => readonly (keyof T["actions"])[];
  readonly getIntentBlockersFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ) => readonly DispatchBlocker[];
  readonly getActionMetadata: TypedGetActionMetadata<T>;
  readonly isActionAvailableFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    name: keyof T["actions"],
  ) => boolean;
  readonly isActionAvailable: (name: keyof T["actions"]) => boolean;
  readonly isIntentDispatchableFor: (
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ) => boolean;
  readonly isIntentDispatchable: TypedIsIntentDispatchable<T>;
  readonly getIntentBlockers: TypedGetIntentBlockers<T>;
  readonly getSchemaGraph: () => SchemaGraph;
  readonly simulateSync: (
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ) => SimulateResult<T>;
  readonly simulate: TypedSimulate<T>;
  readonly dispose: () => void;
  readonly isDisposed: () => boolean;
  readonly getVisibleCoreSnapshot: () => CoreSnapshot;
  readonly setVisibleSnapshot: (
    snapshot: CoreSnapshot,
    options?: { readonly notify?: boolean },
  ) => Snapshot<T["state"]>;
  readonly restoreVisibleSnapshot: () => void;
  readonly emitEvent: <K extends ManifestoEvent>(
    event: K,
    payload: ManifestoEventMap<T>[K],
  ) => void;
  readonly enqueue: <R>(task: () => Promise<R>) => Promise<R>;
  readonly ensureIntentId: (intent: TypedIntent<T>) => TypedIntent<T>;
  readonly executeHost: (
    intent: TypedIntent<T>,
    options?: HostDispatchOptions,
  ) => Promise<HostResult>;
  readonly createUnavailableError: (intent: TypedIntent<T>) => ManifestoError;
  readonly createNotDispatchableError: (intent: TypedIntent<T>) => ManifestoError;
  readonly rejectUnavailable: (intent: TypedIntent<T>) => never;
  readonly rejectNotDispatchable: (intent: TypedIntent<T>) => never;
  readonly [EXTENSION_KERNEL]: ExtensionKernel<T>;
}

export type RuntimeKernelFactory<T extends ManifestoDomainShape> = () => RuntimeKernel<T>;

export type InternalComposableManifesto<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
> = ComposableManifesto<T, Laws> & {
  readonly [RUNTIME_KERNEL_FACTORY]: RuntimeKernelFactory<T>;
  readonly [ACTIVATION_STATE]: ActivationState;
};

type ExtensionKernelCarrier<T extends ManifestoDomainShape> = {
  readonly [EXTENSION_KERNEL]: ExtensionKernel<T>;
};

type RuntimeKernelOptions<T extends ManifestoDomainShape> = {
  readonly schema: DomainSchema;
  readonly projectionPlan: SnapshotProjectionPlan;
  readonly host: ManifestoHost;
  readonly hostContextProvider: HostContextProvider;
  readonly MEL: TypedMEL<T>;
  readonly createIntent: TypedCreateIntent<T>;
};

function createSdkSchemaGraph(rawGraph: RawSchemaGraph): SchemaGraph {
  const nodeIds = new Set(rawGraph.nodes.map((node) => node.id));
  const outgoing = new Map<SchemaGraphNodeId, Set<SchemaGraphNodeId>>();
  const incoming = new Map<SchemaGraphNodeId, Set<SchemaGraphNodeId>>();

  const link = (
    index: Map<SchemaGraphNodeId, Set<SchemaGraphNodeId>>,
    from: SchemaGraphNodeId,
    to: SchemaGraphNodeId,
  ): void => {
    const next = index.get(from);
    if (next) {
      next.add(to);
      return;
    }
    index.set(from, new Set([to]));
  };

  for (const edge of rawGraph.edges) {
    link(outgoing, edge.from, edge.to);
    link(incoming, edge.to, edge.from);
  }

  const materialize = (included: ReadonlySet<SchemaGraphNodeId>): SchemaGraph => {
    const subgraph: RawSchemaGraph = Object.freeze({
      nodes: Object.freeze(
        rawGraph.nodes.filter((node) => included.has(node.id)),
      ),
      edges: Object.freeze(
        rawGraph.edges.filter(
          (edge) => included.has(edge.from) && included.has(edge.to),
        ),
      ),
    });
    return createSdkSchemaGraph(subgraph);
  };

  const trace = (
    target: SchemaGraphNodeRef | SchemaGraphNodeId,
    direction: "incoming" | "outgoing",
  ): SchemaGraph => {
    const seed = resolveSchemaGraphNodeId(target, nodeIds);
    const frontier: SchemaGraphNodeId[] = [seed];
    const seen = new Set<SchemaGraphNodeId>([seed]);
    const index = direction === "incoming" ? incoming : outgoing;

    while (frontier.length > 0) {
      const current = frontier.shift();
      if (!current) {
        continue;
      }

      for (const next of index.get(current) ?? []) {
        if (seen.has(next)) {
          continue;
        }

        seen.add(next);
        frontier.push(next);
      }
    }

    return materialize(seen);
  };

  return Object.freeze({
    nodes: rawGraph.nodes,
    edges: rawGraph.edges,
    traceUp(target: SchemaGraphNodeRef | SchemaGraphNodeId): SchemaGraph {
      return trace(target, "incoming");
    },
    traceDown(target: SchemaGraphNodeRef | SchemaGraphNodeId): SchemaGraph {
      return trace(target, "outgoing");
    },
  });
}

function resolveSchemaGraphNodeId(
  target: SchemaGraphNodeRef | SchemaGraphNodeId,
  nodeIds: ReadonlySet<SchemaGraphNodeId>,
): SchemaGraphNodeId {
  if (typeof target === "string") {
    if (!SCHEMA_GRAPH_NODE_ID_PATTERN.test(target)) {
      throw new ManifestoError(
        "SCHEMA_ERROR",
        'SchemaGraph node id must use "state:<name>", "computed:<name>", or "action:<name>"',
      );
    }

    if (!nodeIds.has(target as SchemaGraphNodeId)) {
      throw new ManifestoError(
        "SCHEMA_ERROR",
        `Unknown SchemaGraph node id "${target}"`,
      );
    }

    return target as SchemaGraphNodeId;
  }

  let nodeId: SchemaGraphNodeId;
  switch (target.__kind) {
    case "ActionRef":
      nodeId = `action:${String(target.name)}`;
      break;
    case "FieldRef":
      nodeId = `state:${target.name}`;
      break;
    case "ComputedRef":
      nodeId = `computed:${target.name}`;
      break;
    default:
      throw new ManifestoError(
        "SCHEMA_ERROR",
        "Unsupported SchemaGraph ref lookup target",
      );
  }

  if (!nodeIds.has(nodeId)) {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      `SchemaGraph node "${nodeId}" is not part of the projected graph`,
    );
  }

  return nodeId;
}

function diffProjectedPaths<T>(
  left: Snapshot<T>,
  right: Snapshot<T>,
): readonly string[] {
  const paths = new Set<string>();
  const seen = new WeakMap<object, WeakSet<object>>();

  const visit = (a: unknown, b: unknown, path: string): void => {
    if (Object.is(a, b)) {
      return;
    }

    if (a === null || b === null) {
      paths.add(path);
      return;
    }

    if (typeof a !== "object" || typeof b !== "object") {
      paths.add(path);
      return;
    }

    const leftObject = a as object;
    const rightObject = b as object;
    const leftSeen = seen.get(leftObject);
    if (leftSeen?.has(rightObject)) {
      return;
    }
    if (leftSeen) {
      leftSeen.add(rightObject);
    } else {
      seen.set(leftObject, new WeakSet([rightObject]));
    }

    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b)) {
        paths.add(path);
        return;
      }

      const limit = Math.max(a.length, b.length);
      for (let index = 0; index < limit; index += 1) {
        const leftHas = Object.prototype.hasOwnProperty.call(a, index);
        const rightHas = Object.prototype.hasOwnProperty.call(b, index);
        const childPath = `${path}[${index}]`;
        if (leftHas !== rightHas) {
          paths.add(childPath);
          continue;
        }
        if (!leftHas && !rightHas) {
          continue;
        }
        visit(a[index], b[index], childPath);
      }
      return;
    }

    if (!isPlainDiffableObject(a) || !isPlainDiffableObject(b)) {
      paths.add(path);
      return;
    }

    const keys = new Set([
      ...Object.keys(a),
      ...Object.keys(b),
    ]);
    for (const key of [...keys].sort()) {
      const leftHas = Object.prototype.hasOwnProperty.call(a, key);
      const rightHas = Object.prototype.hasOwnProperty.call(b, key);
      const childPath = `${path}.${key}`;
      if (leftHas !== rightHas) {
        paths.add(childPath);
        continue;
      }
      visit(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        childPath,
      );
    }
  };

  visit(left.data, right.data, "data");
  visit(left.computed, right.computed, "computed");
  visit(left.system, right.system, "system");
  visit(left.meta, right.meta, "meta");

  return Object.freeze([...paths].sort());
}

function isPlainDiffableObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function attachRuntimeKernelFactory<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws>,
  factory: RuntimeKernelFactory<T>,
  activationState?: ActivationState,
): InternalComposableManifesto<T, Laws> {
  Object.defineProperty(manifesto, RUNTIME_KERNEL_FACTORY, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: factory,
  });

  const state = activationState ?? getExistingActivationState(manifesto) ?? {
    activated: false,
  };

  if (!getExistingActivationState(manifesto)) {
    Object.defineProperty(manifesto, ACTIVATION_STATE, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: state,
    });
  }

  return manifesto as InternalComposableManifesto<T, Laws>;
}

export function getRuntimeKernelFactory<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws>,
): RuntimeKernelFactory<T> {
  const internal = manifesto as Partial<InternalComposableManifesto<T, Laws>>;
  const factory = internal[RUNTIME_KERNEL_FACTORY];

  if (typeof factory !== "function") {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      "ComposableManifesto is missing its runtime kernel factory",
    );
  }

  return factory;
}

export function attachExtensionKernel<
  T extends ManifestoDomainShape,
  TInstance extends object,
>(
  runtime: TInstance,
  kernel: RuntimeKernel<T>,
): TInstance {
  Object.defineProperty(runtime, EXTENSION_KERNEL, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: kernel[EXTENSION_KERNEL],
  });

  return runtime;
}

export function getAttachedExtensionKernel<T extends ManifestoDomainShape>(
  runtime: object,
): ExtensionKernel<T> {
  const internal = runtime as Partial<ExtensionKernelCarrier<T>>;
  const kernel = internal[EXTENSION_KERNEL];

  if (!kernel) {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      "Activated runtime is missing its extension kernel",
    );
  }

  return kernel;
}

export function getActivationState<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws>,
): ActivationState {
  const internal = manifesto as Partial<InternalComposableManifesto<T, Laws>>;
  const state = internal[ACTIVATION_STATE];

  if (!state) {
    throw new ManifestoError(
      "SCHEMA_ERROR",
      "ComposableManifesto is missing its activation state",
    );
  }

  return state;
}

export function assertComposableNotActivated<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws>,
): void {
  if (getActivationState(manifesto).activated) {
    throw new AlreadyActivatedError();
  }
}

export function activateComposable<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws>,
): void {
  const state = getActivationState(manifesto);
  if (state.activated) {
    throw new AlreadyActivatedError();
  }
  state.activated = true;
}

function getExistingActivationState<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  manifesto: ComposableManifesto<T, Laws>,
): ActivationState | null {
  const internal = manifesto as Partial<InternalComposableManifesto<T, Laws>>;
  return internal[ACTIVATION_STATE] ?? null;
}

function getActionInputFieldNames(
  input: DomainSchema["actions"][string]["input"],
): readonly string[] {
  if (!input || input.type !== "object" || !input.fields) {
    return [];
  }

  return Object.keys(input.fields);
}

export function createRuntimeKernel<T extends ManifestoDomainShape>({
  schema,
  projectionPlan,
  host,
  hostContextProvider,
  MEL,
  createIntent,
}: RuntimeKernelOptions<T>): RuntimeKernel<T> {
  const initialCanonicalSnapshot = host.getSnapshot();
  if (!initialCanonicalSnapshot) {
    throw new ManifestoError("SCHEMA_ERROR", "Host failed to initialize its genesis snapshot");
  }

  function projectSnapshotFromCanonical(
    snapshot: CoreSnapshot,
  ): Snapshot<T["state"]> {
    return cloneAndDeepFreeze(
      projectCanonicalSnapshot<T["state"]>(snapshot, projectionPlan),
    );
  }

  let visibleCanonicalSnapshot: CoreSnapshot = structuredClone(initialCanonicalSnapshot);
  let visibleProjectedSnapshot = projectSnapshotFromCanonical(
    visibleCanonicalSnapshot,
  );
  let visibleCanonicalReadSnapshot = cloneAndDeepFreeze(
    visibleCanonicalSnapshot as CanonicalSnapshot<T["state"]>,
  );
  let dispatchQueue: Promise<void> = Promise.resolve();
  let disposed = false;
  const schemaGraph = createSdkSchemaGraph(extractSchemaGraph(schema));
  const actionNames = Object.keys(schema.actions) as Array<keyof T["actions"] & string>;
  const actionMetadataByName = Object.freeze(
    Object.fromEntries(
      actionNames.map((name) => {
        const action = schema.actions[name];
        const actionRef = MEL.actions[name] as unknown as RuntimeActionRef | undefined;
        const rawParams = actionRef?.[ACTION_PARAM_NAMES];
        const params = Object.freeze(
          Array.isArray(rawParams) ? [...rawParams] : getActionInputFieldNames(action.input),
        );

        return [name, Object.freeze({
          name,
          params,
          input: action.input,
          description: action.description,
          hasDispatchableGate: action.dispatchable !== undefined,
        })];
      }),
    ),
  ) as Readonly<Record<keyof T["actions"] & string, TypedActionMetadata<T>>>;
  const actionMetadata = Object.freeze(
    actionNames.map((name) => actionMetadataByName[name]),
  ) as readonly TypedActionMetadata<T>[];

  const subscribers = new Set<Subscriber<T["state"], unknown>>();
  const eventListeners = new Map<
    ManifestoEvent,
    Set<(payload: ManifestoEventMap<T>[ManifestoEvent]) => void>
  >();

  function subscribe<R>(
    selector: Selector<T["state"], R>,
    listener: (value: R) => void,
  ): Unsubscribe {
    if (disposed) {
      return () => {};
    }

    let lastValue: R | undefined;
    let initialized = false;

    try {
      lastValue = selector(visibleProjectedSnapshot);
      initialized = true;
    } catch {
      lastValue = undefined;
      initialized = false;
    }

    const subscriber: Subscriber<T["state"], R> = {
      selector,
      listener,
      lastValue,
      initialized,
    };

    subscribers.add(subscriber as Subscriber<T["state"], unknown>);
    return () => {
      subscribers.delete(subscriber as Subscriber<T["state"], unknown>);
    };
  }

  function on<K extends ManifestoEvent>(
    event: K,
    handler: (payload: ManifestoEventMap<T>[K]) => void,
  ): Unsubscribe {
    if (disposed) {
      return () => {};
    }

    let listeners = eventListeners.get(event);
    if (!listeners) {
      listeners = new Set();
      eventListeners.set(
        event,
        listeners as Set<(payload: ManifestoEventMap<T>[ManifestoEvent]) => void>,
      );
    }

    listeners.add(handler as (payload: ManifestoEventMap<T>[ManifestoEvent]) => void);
    return () => {
      listeners?.delete(handler as (payload: ManifestoEventMap<T>[ManifestoEvent]) => void);
    };
  }

  function getSnapshot(): Snapshot<T["state"]> {
    return visibleProjectedSnapshot;
  }

  function getCanonicalSnapshot(): CanonicalSnapshot<T["state"]> {
    return visibleCanonicalReadSnapshot;
  }

  function getAvailableActionsFor(
    snapshot: CanonicalSnapshot<T["state"]>,
  ): readonly (keyof T["actions"])[] {
    return Object.freeze(
      [
        ...queryAvailableActions(schema, snapshot as CoreSnapshot),
      ] as Array<keyof T["actions"]>,
    );
  }

  function getAvailableActions(): readonly (keyof T["actions"])[] {
    return getAvailableActionsFor(visibleCanonicalReadSnapshot);
  }

  function buildDispatchBlocker(
    layer: DispatchBlocker["layer"],
    expression: DispatchBlocker["expression"],
    description?: string,
  ): DispatchBlocker {
    return Object.freeze({
      layer,
      expression,
      evaluatedResult: false,
      ...(description !== undefined ? { description } : {}),
    }) as DispatchBlocker;
  }

  const getActionMetadata: TypedGetActionMetadata<T> = ((name?: keyof T["actions"]) => {
    if (name !== undefined) {
      return actionMetadataByName[String(name) as keyof T["actions"] & string];
    }

    return actionMetadata;
  }) as TypedGetActionMetadata<T>;

  function isActionAvailableFor(
    snapshot: CanonicalSnapshot<T["state"]>,
    name: keyof T["actions"],
  ): boolean {
    return queryActionAvailable(schema, snapshot as CoreSnapshot, String(name));
  }

  function isActionAvailable(name: keyof T["actions"]): boolean {
    return isActionAvailableFor(visibleCanonicalReadSnapshot, name);
  }

  function isIntentDispatchableFor(
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ): boolean {
    return queryIntentDispatchable(schema, snapshot as CoreSnapshot, intent);
  }

  const isIntentDispatchable: TypedIsIntentDispatchable<T> = ((
    action,
    ...args
  ) => isIntentDispatchableFor(
    visibleCanonicalReadSnapshot,
    createIntent(action, ...args),
  )) as TypedIsIntentDispatchable<T>;

  function getIntentBlockersFor(
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ): readonly DispatchBlocker[] {
    const actionName = intent.type as keyof T["actions"] & string;
    const action = schema.actions[actionName];
    if (!action) {
      return Object.freeze([]);
    }

    if (!isActionAvailableFor(snapshot, actionName)) {
      return Object.freeze(
        action.available
          ? [buildDispatchBlocker("available", action.available, action.description)]
          : [],
      );
    }

    if (!isIntentDispatchableFor(snapshot, intent)) {
      return Object.freeze(
        action.dispatchable
          ? [buildDispatchBlocker("dispatchable", action.dispatchable, action.description)]
          : [],
      );
    }

    return Object.freeze([]);
  }

  const getIntentBlockers: TypedGetIntentBlockers<T> = ((
    action,
    ...args
  ) => getIntentBlockersFor(
    visibleCanonicalReadSnapshot,
    createIntent(action, ...args),
  )) as TypedGetIntentBlockers<T>;

  function getSchemaGraph(): SchemaGraph {
    return schemaGraph;
  }

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

  function simulateSync(
    snapshot: CanonicalSnapshot<T["state"]>,
    intent: TypedIntent<T>,
  ): SimulateResult<T> {
    const enrichedIntent = ensureIntentId(intent);
    if (!isActionAvailableFor(snapshot, enrichedIntent.type as keyof T["actions"])) {
      throw createSimulationUnavailableError(enrichedIntent);
    }
    if (!isIntentDispatchableFor(snapshot, enrichedIntent)) {
      throw createSimulationNotDispatchableError(enrichedIntent);
    }

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
    }) as SimulateResult<T>;
  }

  const simulate: TypedSimulate<T> = ((
    action,
    ...args
  ) => {
    const simulated = simulateSync(
      visibleCanonicalReadSnapshot,
      createIntent(action, ...args),
    );
    const projectedSimulated = projectSnapshotFromCanonical(simulated.snapshot);

    return Object.freeze({
      snapshot: projectedSimulated,
      changedPaths: diffProjectedPaths(visibleProjectedSnapshot, projectedSimulated),
      newAvailableActions: getAvailableActionsFor(simulated.snapshot),
      requirements: simulated.requirements,
      status: simulated.status,
    }) as ProjectedSimulateResult<T>;
  }) as TypedSimulate<T>;

  function dispose(): void {
    if (disposed) {
      return;
    }

    disposed = true;
    subscribers.clear();
    eventListeners.clear();
  }

  function setVisibleSnapshot(
    snapshot: CoreSnapshot,
    options?: { readonly notify?: boolean },
  ): Snapshot<T["state"]> {
    visibleCanonicalSnapshot = structuredClone(snapshot);
    host.reset(structuredClone(visibleCanonicalSnapshot));
    visibleCanonicalReadSnapshot = cloneAndDeepFreeze(
      visibleCanonicalSnapshot as CanonicalSnapshot<T["state"]>,
    );

    const nextProjectedSnapshot = projectSnapshotFromCanonical(
      visibleCanonicalSnapshot,
    );
    const projectedChanged = !projectedSnapshotsEqual(
      nextProjectedSnapshot,
      visibleProjectedSnapshot,
    );

    if (projectedChanged) {
      visibleProjectedSnapshot = nextProjectedSnapshot;
    }

    if (options?.notify !== false && projectedChanged) {
      notifySubscribers(visibleProjectedSnapshot);
    }
    return visibleProjectedSnapshot;
  }

  function restoreVisibleSnapshot(): void {
    host.reset(structuredClone(visibleCanonicalSnapshot));
  }

  function emitEvent<K extends ManifestoEvent>(
    event: K,
    payload: ManifestoEventMap<T>[K],
  ): void {
    const listeners = eventListeners.get(event);
    if (!listeners) {
      return;
    }

    for (const handler of listeners) {
      try {
        handler(payload);
      } catch {
        // Event handler failures are isolated from runtime semantics.
      }
    }
  }

  function enqueue<R>(task: () => Promise<R>): Promise<R> {
    const result = dispatchQueue
      .catch(() => {})
      .then(task);

    dispatchQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  function ensureIntentId(intent: TypedIntent<T>): TypedIntent<T> {
    if (intent.intentId && intent.intentId.length > 0) {
      return intent;
    }

    return {
      ...intent,
      intentId: generateUUID(),
    } as TypedIntent<T>;
  }

  async function executeHost(
    intent: TypedIntent<T>,
    options?: HostDispatchOptions,
  ): Promise<HostResult> {
    return host.dispatch(intent, options);
  }

  function createUnavailableError(intent: TypedIntent<T>): ManifestoError {
    return new ManifestoError(
      "ACTION_UNAVAILABLE",
      `Action "${intent.type}" is unavailable against the current visible snapshot`,
    );
  }

  function createNotDispatchableError(intent: TypedIntent<T>): ManifestoError {
    return new ManifestoError(
      "INTENT_NOT_DISPATCHABLE",
      `Action "${intent.type}" is available, but the bound intent is not dispatchable against the current visible snapshot`,
    );
  }

  function rejectRejectedIntent(intent: TypedIntent<T>, error: ManifestoError): never {
    emitEvent("dispatch:rejected", {
      intentId: intent.intentId ?? "",
      intent,
      code: error.code as ManifestoEventMap<T>["dispatch:rejected"]["code"],
      reason: error.message,
    });
    throw error;
  }

  function rejectUnavailable(intent: TypedIntent<T>): never {
    return rejectRejectedIntent(intent, createUnavailableError(intent));
  }

  function rejectNotDispatchable(intent: TypedIntent<T>): never {
    return rejectRejectedIntent(intent, createNotDispatchableError(intent));
  }

  function notifySubscribers(snapshot: Snapshot<T["state"]>): void {
    for (const subscriber of subscribers) {
      let selected: unknown;
      try {
        selected = subscriber.selector(snapshot);
      } catch {
        continue;
      }

      if (subscriber.initialized && Object.is(subscriber.lastValue, selected)) {
        continue;
      }

      subscriber.lastValue = selected;
      subscriber.initialized = true;

      try {
        subscriber.listener(selected);
      } catch {
        // Listener failures are isolated from runtime semantics.
      }
    }
  }

  const extensionKernel = Object.freeze({
    MEL,
    schema,
    createIntent,
    getCanonicalSnapshot,
    projectSnapshot: (
      snapshot: CanonicalSnapshot<T["state"]>,
    ): Snapshot<T["state"]> => projectSnapshotFromCanonical(snapshot),
    simulateSync: (
      snapshot: CanonicalSnapshot<T["state"]>,
      intent: TypedIntent<T>,
    ): ExtensionSimulateResult<T> => {
      const result = simulateSync(snapshot, intent);
      return Object.freeze({
        snapshot: result.snapshot,
        patches: result.patches,
        requirements: result.requirements,
        status: result.status,
      }) as ExtensionSimulateResult<T>;
    },
    getAvailableActionsFor,
    isActionAvailableFor,
    isIntentDispatchableFor,
  }) as ExtensionKernel<T>;

  return {
    schema,
    MEL,
    createIntent,
    subscribe,
    on,
    getSnapshot,
    getAvailableActionsFor,
    getAvailableActions,
    getIntentBlockersFor,
    getActionMetadata,
    isActionAvailableFor,
    isActionAvailable,
    isIntentDispatchableFor,
    isIntentDispatchable,
    getIntentBlockers,
    getSchemaGraph,
    simulateSync,
    simulate,
    dispose,
    isDisposed: () => disposed,
    getCanonicalSnapshot,
    getVisibleCoreSnapshot: () => structuredClone(visibleCanonicalSnapshot),
    setVisibleSnapshot,
    restoreVisibleSnapshot,
    emitEvent,
    enqueue,
    ensureIntentId,
    executeHost,
    createUnavailableError,
    createNotDispatchableError,
    rejectUnavailable,
    rejectNotDispatchable,
    [EXTENSION_KERNEL]: extensionKernel,
  };
}

export function createBaseRuntimeInstance<T extends ManifestoDomainShape>(
  kernel: RuntimeKernel<T>,
): ManifestoBaseInstance<T> {
  async function processIntent(intent: TypedIntent<T>): Promise<Snapshot<T["state"]>> {
    if (kernel.isDisposed()) {
      throw new DisposedError();
    }

    if (!kernel.isActionAvailable(intent.type as keyof T["actions"])) {
      return kernel.rejectUnavailable(intent);
    }
    if (!kernel.isIntentDispatchableFor(kernel.getCanonicalSnapshot(), intent)) {
      return kernel.rejectNotDispatchable(intent);
    }

    let result: HostResult;
    try {
      result = await kernel.executeHost(intent);
    } catch (error) {
      const failure = toError(error);
      kernel.emitEvent("dispatch:failed", {
        intentId: intent.intentId ?? "",
        intent,
        error: failure,
      });
      throw failure;
    }

    if (result.status === "error") {
      const publishedSnapshot = kernel.setVisibleSnapshot(result.snapshot);
      const failure = result.error ?? new ManifestoError("HOST_ERROR", "Host dispatch failed");
      kernel.emitEvent("dispatch:failed", {
        intentId: intent.intentId ?? "",
        intent,
        error: failure,
        snapshot: publishedSnapshot,
      });
      throw failure;
    }

    const publishedSnapshot = kernel.setVisibleSnapshot(result.snapshot);
    kernel.emitEvent("dispatch:completed", {
      intentId: intent.intentId ?? "",
      intent,
      snapshot: publishedSnapshot,
    });
    return publishedSnapshot;
  }

  function dispatchAsync(intent: TypedIntent<T>): Promise<Snapshot<T["state"]>> {
    if (kernel.isDisposed()) {
      return Promise.reject(new DisposedError());
    }

    const enrichedIntent = kernel.ensureIntentId(intent);
    return kernel.enqueue(() => processIntent(enrichedIntent));
  }

  return attachExtensionKernel({
    createIntent: kernel.createIntent,
    dispatchAsync,
    subscribe: kernel.subscribe,
    on: kernel.on,
    getSnapshot: kernel.getSnapshot,
    getCanonicalSnapshot: kernel.getCanonicalSnapshot,
    getAvailableActions: kernel.getAvailableActions,
    isIntentDispatchable: kernel.isIntentDispatchable,
    getIntentBlockers: kernel.getIntentBlockers,
    getActionMetadata: kernel.getActionMetadata,
    isActionAvailable: kernel.isActionAvailable,
    getSchemaGraph: kernel.getSchemaGraph,
    simulate: kernel.simulate,
    MEL: kernel.MEL,
    schema: kernel.schema,
    dispose: kernel.dispose,
  }, kernel);
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(String(error));
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
