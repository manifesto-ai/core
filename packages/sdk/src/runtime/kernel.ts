import {
  evaluateComputed,
  getAvailableActions as queryAvailableActions,
  isErr,
  isActionAvailable as queryActionAvailable,
  isIntentDispatchable as queryIntentDispatchable,
  type DomainSchema,
  type Snapshot as CoreSnapshot,
} from "@manifesto-ai/core";
import {
  extractSchemaGraph,
} from "@manifesto-ai/compiler";
import type {
  HostResult,
} from "@manifesto-ai/host";

import {
  ManifestoError,
} from "../errors.js";
import type {
  CanonicalSnapshot,
  DomainExternalContext,
  ExternalContext,
  ContextUpdater,
  ManifestoDomainShape,
  SchemaGraph,
  SimulateResult as ProjectedSimulateResult,
  Snapshot,
  TypedActionMetadata,
  TypedGetActionMetadata,
  TypedGetIntentBlockers,
  TypedIntent,
  TypedIsIntentDispatchable,
  TypedSimulateIntent,
} from "../types.js";
import {
  cloneAndDeepFreeze,
  projectCanonicalSnapshot,
} from "../projection/snapshot-projection.js";
import type {
  ExtensionKernel,
  ExtensionSimulateResult,
} from "../extensions-types.js";
import type {
  HostDispatchOptions,
  RuntimeKernel,
  RuntimeKernelOptions,
} from "../compat/internal.js";
import {
  ACTION_PARAM_NAMES,
  ACTION_SINGLE_PARAM_OBJECT_VALUE,
  EXTENSION_KERNEL,
} from "../compat/runtime-symbols.js";
import {
  createSdkSchemaGraph,
} from "./schema-graph.js";
import {
  createRuntimeAdmission,
} from "./admission.js";
import {
  createRuntimePublication,
} from "./publication.js";
import {
  createRuntimeReportHelpers,
  diffProjectedPaths,
} from "./reports.js";
import {
  createRuntimeSimulation,
} from "./simulation.js";
import {
  createRuntimeStateStore,
} from "./state-store.js";
import {
  generateUUID,
} from "./uuid.js";
import {
  captureExternalContext as captureContextOverride,
  materializeExternalContext,
} from "./context.js";
import type {
  RuntimeSimulateSync,
} from "./facets.js";

type RuntimeActionParamMetadata = readonly string[] | null;
type RuntimeActionRef = {
  readonly name: PropertyKey;
  readonly [ACTION_PARAM_NAMES]?: RuntimeActionParamMetadata;
  readonly [ACTION_SINGLE_PARAM_OBJECT_VALUE]?: boolean;
};

const RESERVED_PUBLIC_ACTION_NAMES = new Set([
  "then",
  "constructor",
  "prototype",
  "__proto__",
]);

function getActionParamNames(
  action: DomainSchema["actions"][string],
): readonly string[] {
  if (action.params) {
    return action.params;
  }

  const input = action.input;
  if (!input || input.type !== "object" || !input.fields) {
    return [];
  }

  return Object.keys(input.fields);
}

function isThenable(value: unknown): boolean {
  return typeof value === "object"
    && value !== null
    && "then" in value
    && typeof (value as { readonly then?: unknown }).then === "function";
}

export function createRuntimeKernel<T extends ManifestoDomainShape>({
  schema,
  projectionPlan,
  actionAnnotations,
  host,
  hostContextProvider,
  MEL,
  createIntent,
  initialContext,
}: RuntimeKernelOptions<T>): RuntimeKernel<T> {
  const refs = MEL;
  const initialCanonicalSnapshot = host.getSnapshot();
  if (!initialCanonicalSnapshot) {
    throw new ManifestoError("SCHEMA_ERROR", "Host failed to initialize its genesis snapshot");
  }

  function projectSnapshotFromCanonical(
    snapshot: CoreSnapshot,
  ): Snapshot<T["state"], T["computed"]> {
    return cloneAndDeepFreeze(
      projectCanonicalSnapshot<T["state"], T["computed"]>(snapshot, projectionPlan),
    );
  }

  function rehydrateSnapshot(snapshot: CoreSnapshot): CoreSnapshot {
    const computed = evaluateComputed(schema, snapshot);
    if (isErr(computed)) {
      throw new ManifestoError(
        "SNAPSHOT_REHYDRATION_FAILED",
        `Failed to rehydrate restored snapshot computed values: ${computed.error.message}`,
        { cause: computed.error },
      );
    }

    return {
      ...snapshot,
      computed: computed.value,
    };
  }

  const stateStore = createRuntimeStateStore<T>({
    host,
    initialCanonicalSnapshot,
    projectSnapshotFromCanonical,
  });
  const {
    subscribe,
    on,
    getSnapshot,
    getCanonicalSnapshot,
    getVisibleCoreSnapshot,
    setVisibleSnapshot,
    restoreVisibleSnapshot,
    emitEvent,
    enqueue,
    dispose,
    isDisposed,
  } = stateStore;
  const schemaGraph = createSdkSchemaGraph(extractSchemaGraph(schema));
  const actionNames = Object.keys(schema.actions) as Array<keyof T["actions"] & string>;
  assertNoReservedPublicActionNames(actionNames);
  let currentExternalContext = materializeExternalContext<T>(
    schema,
    initialContext,
    "createManifesto",
  );
  const actionMetadataByName = Object.freeze(
    Object.fromEntries(
      actionNames.map((name) => {
        const action = schema.actions[name];
        const actionRef = refs.actions[name] as unknown as RuntimeActionRef | undefined;
        const rawParams = actionRef?.[ACTION_PARAM_NAMES];
        const params = Object.freeze(
          Array.isArray(rawParams) ? [...rawParams] : getActionParamNames(action),
        );
        const publicArity = rawParams === null ? 1 : params.length;
        const requiredArity = action.input?.required === false ? 0 : publicArity;

        return [name, Object.freeze({
          name,
          params,
          publicArity,
          requiredArity,
          input: action.input,
          ...(action.inputType !== undefined ? { inputType: action.inputType } : {}),
          description: action.description,
          ...(actionAnnotations[name] !== undefined
            ? { annotations: actionAnnotations[name] }
            : {}),
          hasDispatchableGate: action.dispatchable !== undefined,
        })];
      }),
    ),
  ) as Readonly<Record<keyof T["actions"] & string, TypedActionMetadata<T>>>;
  const actionMetadata = Object.freeze(
    actionNames.map((name) => actionMetadataByName[name]),
  ) as readonly TypedActionMetadata<T>[];

  function getAvailableActionsFor(
    snapshot: CanonicalSnapshot<T["state"]>,
  ): readonly (keyof T["actions"])[] {
    return Object.freeze(
      [
        ...queryAvailableActions(schema, snapshot as CoreSnapshot),
      ] as Array<keyof T["actions"]>,
    );
  }

  const reportHelpers = createRuntimeReportHelpers<T>({
    getAvailableActionsFor,
    projectSnapshotFromCanonical,
  });

  function getAvailableActions(): readonly (keyof T["actions"])[] {
    return getAvailableActionsFor(getCanonicalSnapshot());
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
    return isActionAvailableFor(getCanonicalSnapshot(), name);
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
    getCanonicalSnapshot(),
    createIntent(action, ...args),
  )) as TypedIsIntentDispatchable<T>;

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

  function getExternalContext(): DomainExternalContext<T> {
    return currentExternalContext;
  }

  function replaceExternalContext(
    next: DomainExternalContext<T>,
  ): DomainExternalContext<T> {
    currentExternalContext = materializeExternalContext<T>(
      schema,
      next,
      "injectContext",
    );
    return currentExternalContext;
  }

  function updateExternalContext(
    updater: ContextUpdater<DomainExternalContext<T>>,
  ): DomainExternalContext<T> {
    const next = updater(currentExternalContext);
    if (isThenable(next)) {
      throw new ManifestoError(
        "INVALID_CONTEXT",
        "updateContext() updater must return a synchronous JSON context value",
      );
    }
    currentExternalContext = materializeExternalContext<T>(
      schema,
      next,
      "updateContext",
    );
    return currentExternalContext;
  }

  function captureExternalContext(
    override?: ExternalContext,
  ): DomainExternalContext<T> {
    return captureContextOverride<T>(
      schema,
      currentExternalContext,
      override,
      "transition",
    );
  }

  function createComputeContext(
    intent: TypedIntent<T>,
    externalContext?: ExternalContext,
  ) {
    const materializedExternalContext = externalContext === undefined
      ? currentExternalContext
      : captureContextOverride<T>(
        schema,
        currentExternalContext,
        externalContext,
        "transition",
      );
    return hostContextProvider.createFrozenContext(
      intent.intentId,
      materializedExternalContext,
    );
  }

  let simulateSyncRef: RuntimeSimulateSync<T> | null = null;
  const admission = createRuntimeAdmission<T>({
    schema,
    ensureIntentId,
    getAvailableActionsFor,
    isActionAvailableFor,
    isIntentDispatchableFor,
    projectSnapshotFromCanonical,
    getSimulateSync: () => {
      if (!simulateSyncRef) {
        throw new ManifestoError(
          "SCHEMA_ERROR",
          "Runtime simulation surface is not initialized",
        );
      }

      return simulateSyncRef;
    },
  });
  const simulation = createRuntimeSimulation<T>({
    schema,
    hostContextProvider,
    evaluateIntentLegalityFor: admission.evaluateIntentLegalityFor,
  });
  simulateSyncRef = simulation.simulateSync;
  const publication = createRuntimePublication<T>({
    setVisibleSnapshot,
    restoreVisibleSnapshot,
    getCanonicalSnapshot,
  });

  const getIntentBlockersFor = admission.getIntentBlockersFor;
  const getIntentBlockers: TypedGetIntentBlockers<T> = ((
    action,
    ...args
  ) => getIntentBlockersFor(
    getCanonicalSnapshot(),
    createIntent(action, ...args),
  )) as TypedGetIntentBlockers<T>;
  const simulateSync: RuntimeKernel<T>["simulateSync"] = (
    snapshot,
    intent,
    options,
  ) => {
    const context = options?.context ?? createComputeContext(
      intent,
      options?.externalContext ?? captureExternalContext(),
    );
    return simulation.simulateSync(snapshot, intent, { context });
  };
  function projectCurrentSimulationResult(
    simulated: ReturnType<RuntimeKernel<T>["simulateSync"]>,
  ): ProjectedSimulateResult<T> {
    const projectedSimulated = projectSnapshotFromCanonical(simulated.snapshot);

    return Object.freeze({
      snapshot: projectedSimulated,
      changedPaths: diffProjectedPaths(getSnapshot(), projectedSimulated),
      newAvailableActions: getAvailableActionsFor(simulated.snapshot),
      requirements: simulated.requirements,
      status: simulated.status,
      diagnostics: simulated.diagnostics,
    }) as ProjectedSimulateResult<T>;
  }

  const simulateIntent = ((
    intent,
  ) => projectCurrentSimulationResult(
    simulateSync(getCanonicalSnapshot(), intent),
  )) as TypedSimulateIntent<T>;

  const simulate = ((
    action,
    ...args
  ) => {
    return simulateIntent(createIntent(action, ...args));
  }) as RuntimeKernel<T>["simulate"];

  const extensionKernel = Object.freeze({
    refs,
    MEL,
    schema,
    createIntent,
    getCanonicalSnapshot,
    projectSnapshot: (
      snapshot: CanonicalSnapshot<T["state"]>,
    ): Snapshot<T["state"], T["computed"]> => projectSnapshotFromCanonical(snapshot),
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
        diagnostics: result.diagnostics,
      }) as ExtensionSimulateResult<T>;
    },
    getAvailableActionsFor,
    isActionAvailableFor,
    isIntentDispatchableFor,
    explainIntentFor: admission.explainIntentFor,
  }) as ExtensionKernel<T>;

  return {
    schema,
    refs,
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
    getSchemaGraph(): SchemaGraph {
      return schemaGraph;
    },
    simulateSync,
    simulate,
    simulateIntent,
    dispose,
    isDisposed,
    getCanonicalSnapshot,
    getVisibleCoreSnapshot,
    rehydrateSnapshot,
    setVisibleSnapshot: publication.replaceVisibleSnapshot,
    restoreVisibleSnapshot: publication.restoreVisibleSnapshot,
    emitEvent,
    enqueue,
    ensureIntentId,
    executeHost,
    createComputeContext,
    getExternalContext,
    replaceExternalContext,
    updateExternalContext,
    captureExternalContext,
    validateIntentInputFor: admission.validateIntentInputFor,
    evaluateIntentLegalityFor: admission.evaluateIntentLegalityFor,
    deriveIntentAdmission: admission.deriveIntentAdmission,
    deriveExecutionOutcome: reportHelpers.deriveExecutionOutcome,
    classifyExecutionFailure: reportHelpers.classifyExecutionFailure,
    createExecutionDiagnostics: reportHelpers.createExecutionDiagnostics,
    createUnavailableError: admission.createUnavailableError,
    createNotDispatchableError: admission.createNotDispatchableError,
    rejectInvalidInput: admission.rejectInvalidInput,
    rejectUnavailable: admission.rejectUnavailable,
    rejectNotDispatchable: admission.rejectNotDispatchable,
    [EXTENSION_KERNEL]: extensionKernel,
  };
}

function assertNoReservedPublicActionNames(actionNames: readonly string[]): void {
  const reserved = actionNames.filter((name) => RESERVED_PUBLIC_ACTION_NAMES.has(name));
  if (reserved.length === 0) {
    return;
  }

  throw new ManifestoError(
    "RESERVED_ACTION_NAME",
    `Action name${reserved.length === 1 ? "" : "s"} ${
      reserved.map((name) => `"${name}"`).join(", ")
    } ${reserved.length === 1 ? "is" : "are"} reserved by the SDK public action namespace`,
  );
}
