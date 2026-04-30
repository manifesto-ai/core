import type { Snapshot as CoreSnapshot } from "@manifesto-ai/core";
import type { ManifestoHost } from "@manifesto-ai/host";

import type {
  CanonicalSnapshot,
  ManifestoDomainShape,
  ManifestoEvent,
  ManifestoEventPayloadMap,
  Selector,
  Snapshot,
  Unsubscribe,
} from "../types.js";
import {
  cloneAndDeepFreeze,
  projectedSnapshotsEqual,
} from "../projection/snapshot-projection.js";
import type {
  RuntimeStateStore,
} from "./facets.js";

interface Subscriber<TState, R> {
  readonly selector: Selector<TState, R>;
  readonly listener: (value: R) => void;
  lastValue: R | undefined;
  initialized: boolean;
}

type RuntimeStateStoreOptions<T extends ManifestoDomainShape> = {
  readonly host: ManifestoHost;
  readonly initialCanonicalSnapshot: CoreSnapshot;
  readonly projectSnapshotFromCanonical: (
    snapshot: CoreSnapshot,
  ) => Snapshot<T["state"]>;
};

export function createRuntimeStateStore<T extends ManifestoDomainShape>({
  host,
  initialCanonicalSnapshot,
  projectSnapshotFromCanonical,
}: RuntimeStateStoreOptions<T>): RuntimeStateStore<T> {
  let visibleCanonicalSnapshot: CoreSnapshot = structuredClone(initialCanonicalSnapshot);
  let visibleProjectedSnapshot = projectSnapshotFromCanonical(
    visibleCanonicalSnapshot,
  );
  let visibleCanonicalReadSnapshot = cloneAndDeepFreeze(
    visibleCanonicalSnapshot as CanonicalSnapshot<T["state"]>,
  );
  let dispatchQueue: Promise<void> = Promise.resolve();
  let disposed = false;

  const subscribers = new Set<Subscriber<T["state"], unknown>>();
  const eventListeners = new Map<
    ManifestoEvent,
    Set<(payload: ManifestoEventPayloadMap[ManifestoEvent]) => void>
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
    handler: (payload: ManifestoEventPayloadMap[K]) => void,
  ): Unsubscribe {
    if (disposed) {
      return () => {};
    }

    let listeners = eventListeners.get(event);
    if (!listeners) {
      listeners = new Set();
      eventListeners.set(
        event,
        listeners as Set<(payload: ManifestoEventPayloadMap[ManifestoEvent]) => void>,
      );
    }

    listeners.add(handler as (payload: ManifestoEventPayloadMap[ManifestoEvent]) => void);
    return () => {
      listeners?.delete(handler as (payload: ManifestoEventPayloadMap[ManifestoEvent]) => void);
    };
  }

  function getSnapshot(): Snapshot<T["state"]> {
    return visibleProjectedSnapshot;
  }

  function getCanonicalSnapshot(): CanonicalSnapshot<T["state"]> {
    return visibleCanonicalReadSnapshot;
  }

  function getVisibleCoreSnapshot(): CoreSnapshot {
    return structuredClone(visibleCanonicalSnapshot);
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
    payload: ManifestoEventPayloadMap[K],
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

  function dispose(): void {
    if (disposed) {
      return;
    }

    disposed = true;
    subscribers.clear();
    eventListeners.clear();
  }

  function isDisposed(): boolean {
    return disposed;
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
  };
}
