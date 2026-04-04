import {
  getAvailableActions as queryAvailableActions,
  isActionAvailable as queryActionAvailable,
  type DomainSchema,
  type Snapshot as CoreSnapshot,
} from "@manifesto-ai/core";
import type { HostResult, ManifestoHost } from "@manifesto-ai/host";

import {
  AlreadyActivatedError,
  DisposedError,
  ManifestoError,
} from "./errors.js";
import type {
  BaseLaws,
  CanonicalSnapshot,
  ComposableManifesto,
  ManifestoBaseInstance,
  ManifestoDomainShape,
  ManifestoEvent,
  ManifestoEventMap,
  Selector,
  Snapshot,
  TypedActionMetadata,
  TypedCreateIntent,
  TypedGetActionMetadata,
  TypedIntent,
  TypedMEL,
  TypedOn,
  TypedSubscribe,
  Unsubscribe,
} from "./types.js";
import {
  cloneAndDeepFreeze,
  projectCanonicalSnapshot,
  projectedSnapshotsEqual,
  type SnapshotProjectionPlan,
} from "./snapshot-projection.js";

export const ACTION_PARAM_NAMES = Symbol("manifesto-sdk.action-param-names");
export const RUNTIME_KERNEL_FACTORY = Symbol("manifesto-sdk.runtime-kernel-factory");
export const ACTIVATION_STATE = Symbol("manifesto-sdk.activation-state");

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

export interface RuntimeKernel<T extends ManifestoDomainShape> {
  readonly schema: DomainSchema;
  readonly MEL: TypedMEL<T>;
  readonly createIntent: TypedCreateIntent<T>;
  readonly subscribe: TypedSubscribe<T>;
  readonly on: TypedOn<T>;
  readonly getSnapshot: () => Snapshot<T["state"]>;
  readonly getCanonicalSnapshot: () => CanonicalSnapshot<T["state"]>;
  readonly getAvailableActions: () => readonly (keyof T["actions"])[];
  readonly getActionMetadata: TypedGetActionMetadata<T>;
  readonly isActionAvailable: (name: keyof T["actions"]) => boolean;
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
  readonly rejectUnavailable: (intent: TypedIntent<T>) => never;
}

export type RuntimeKernelFactory<T extends ManifestoDomainShape> = () => RuntimeKernel<T>;

export type InternalComposableManifesto<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
> = ComposableManifesto<T, Laws> & {
  readonly [RUNTIME_KERNEL_FACTORY]: RuntimeKernelFactory<T>;
  readonly [ACTIVATION_STATE]: ActivationState;
};

type RuntimeKernelOptions<T extends ManifestoDomainShape> = {
  readonly schema: DomainSchema;
  readonly projectionPlan: SnapshotProjectionPlan;
  readonly host: ManifestoHost;
  readonly MEL: TypedMEL<T>;
  readonly createIntent: TypedCreateIntent<T>;
};

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
  MEL,
  createIntent,
}: RuntimeKernelOptions<T>): RuntimeKernel<T> {
  const initialCanonicalSnapshot = host.getSnapshot();
  if (!initialCanonicalSnapshot) {
    throw new ManifestoError("SCHEMA_ERROR", "Host failed to initialize its genesis snapshot");
  }

  let visibleCanonicalSnapshot: CoreSnapshot = structuredClone(initialCanonicalSnapshot);
  let visibleProjectedSnapshot = cloneAndDeepFreeze(
    projectCanonicalSnapshot<T["state"]>(
      visibleCanonicalSnapshot,
      projectionPlan,
    ),
  );
  let visibleCanonicalReadSnapshot = cloneAndDeepFreeze(
    visibleCanonicalSnapshot as CanonicalSnapshot<T["state"]>,
  );
  let dispatchQueue: Promise<void> = Promise.resolve();
  let disposed = false;
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

  function getAvailableActions(): readonly (keyof T["actions"])[] {
    return queryAvailableActions(
      schema,
      visibleCanonicalSnapshot,
    ) as readonly (keyof T["actions"])[];
  }

  const getActionMetadata: TypedGetActionMetadata<T> = ((name?: keyof T["actions"]) => {
    if (name !== undefined) {
      return actionMetadataByName[String(name) as keyof T["actions"] & string];
    }

    return actionMetadata;
  }) as TypedGetActionMetadata<T>;

  function isActionAvailable(name: keyof T["actions"]): boolean {
    return queryActionAvailable(schema, visibleCanonicalSnapshot, String(name));
  }

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

    const nextProjectedSnapshot = projectCanonicalSnapshot<T["state"]>(
      visibleCanonicalSnapshot,
      projectionPlan,
    );
    const projectedChanged = !projectedSnapshotsEqual(
      nextProjectedSnapshot,
      visibleProjectedSnapshot,
    );

    if (projectedChanged) {
      visibleProjectedSnapshot = cloneAndDeepFreeze(nextProjectedSnapshot);
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

  function rejectUnavailable(intent: TypedIntent<T>): never {
    const error = new ManifestoError(
      "ACTION_UNAVAILABLE",
      `Action "${intent.type}" is unavailable against the current visible snapshot`,
    );
    emitEvent("dispatch:rejected", {
      intentId: intent.intentId ?? "",
      intent,
      reason: error.message,
    });
    throw error;
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

  return {
    schema,
    MEL,
    createIntent,
    subscribe,
    on,
    getSnapshot,
    getAvailableActions,
    getActionMetadata,
    isActionAvailable,
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
    rejectUnavailable,
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

  return {
    createIntent: kernel.createIntent,
    dispatchAsync,
    subscribe: kernel.subscribe,
    on: kernel.on,
    getSnapshot: kernel.getSnapshot,
    getCanonicalSnapshot: kernel.getCanonicalSnapshot,
    getAvailableActions: kernel.getAvailableActions,
    getActionMetadata: kernel.getActionMetadata,
    isActionAvailable: kernel.isActionAvailable,
    MEL: kernel.MEL,
    schema: kernel.schema,
    dispose: kernel.dispose,
  };
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
