import type { Snapshot as CoreSnapshot } from "@manifesto-ai/core";
import type { ManifestoHost } from "@manifesto-ai/host";

import { ManifestoError } from "../errors.js";
import type {
  CanonicalSnapshot,
  ManifestoDomainShape,
  ManifestoEvent,
  ManifestoEventPayloadMap,
  Selector,
  Snapshot,
  Unsubscribe,
} from "../types.js";
import { cloneAndDeepFreeze, projectedSnapshotsEqual } from "../projection/snapshot-projection.js";
import type { RuntimeStateStore } from "./facets.js";
import { findCanonicalSnapshotValueViolation } from "./snapshot-value-domain.js";

const SNAPSHOT_TOP_LEVEL_KEYS = new Set([
  "state",
  "computed",
  "system",
  "input",
  "meta",
  "namespaces",
]);

const SNAPSHOT_REQUIRED_OBJECT_KEYS = ["state", "system", "meta"] as const;

/**
 * Hydration inputs are external data by definition (restore files, persisted
 * stores, cross-version tooling), so the visible-snapshot seam validates the
 * canonical top-level shape instead of silently dropping unknown keys (#492:
 * a v4-era "data" key next to the real "state" disabled state preservation
 * with no error, warning, or log).
 */
function assertCanonicalSnapshotShape(snapshot: CoreSnapshot): void {
  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new ManifestoError(
      "INVALID_SNAPSHOT_SHAPE",
      "Visible snapshot must be a canonical snapshot object",
    );
  }

  const record = snapshot as unknown as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter((key) => !SNAPSHOT_TOP_LEVEL_KEYS.has(key));
  if (unknownKeys.length > 0) {
    const dataHint = unknownKeys.includes("data")
      ? ' Domain state lives under "state" since v5; the v4 "data" key was renamed.'
      : "";
    throw new ManifestoError(
      "INVALID_SNAPSHOT_SHAPE",
      `Visible snapshot has unknown top-level key(s): ${unknownKeys.join(", ")}.${dataHint}` +
        " Expected only: state, computed, system, input, meta, namespaces.",
    );
  }

  for (const key of SNAPSHOT_REQUIRED_OBJECT_KEYS) {
    const value = record[key];
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new ManifestoError(
        "INVALID_SNAPSHOT_SHAPE",
        `Visible snapshot is missing the required "${key}" object`,
      );
    }
  }
}

function assertCanonicalSnapshotValueDomain(snapshot: CoreSnapshot): void {
  const violation = findCanonicalSnapshotValueViolation(snapshot);
  if (!violation) {
    return;
  }

  throw new ManifestoError(
    "INVALID_SNAPSHOT_VALUE",
    `Visible snapshot contains a non-JSON value at ${violation.path}: ${violation.reason}`,
  );
}

interface Subscriber<TState, TComputed, R> {
  readonly selector: Selector<TState, R, TComputed>;
  readonly listener: (value: R) => void;
  lastValue: R | undefined;
  initialized: boolean;
}

type RuntimeStateStoreOptions<T extends ManifestoDomainShape> = {
  readonly host: ManifestoHost;
  readonly initialCanonicalSnapshot: CoreSnapshot;
  readonly projectSnapshotFromCanonical: (
    snapshot: CoreSnapshot,
  ) => Snapshot<T["state"], T["computed"]>;
};

export function createRuntimeStateStore<T extends ManifestoDomainShape>({
  host,
  initialCanonicalSnapshot,
  projectSnapshotFromCanonical,
}: RuntimeStateStoreOptions<T>): RuntimeStateStore<T> {
  let visibleCanonicalSnapshot: CoreSnapshot = structuredClone(initialCanonicalSnapshot);
  let visibleProjectedSnapshot = projectSnapshotFromCanonical(visibleCanonicalSnapshot);
  let visibleCanonicalReadSnapshot = cloneAndDeepFreeze(
    visibleCanonicalSnapshot as CanonicalSnapshot<T["state"]>,
  );
  let dispatchQueue: Promise<void> = Promise.resolve();
  let disposed = false;

  const subscribers = new Set<Subscriber<T["state"], T["computed"], unknown>>();
  const eventListeners = new Map<
    ManifestoEvent,
    Set<(payload: ManifestoEventPayloadMap[ManifestoEvent]) => void>
  >();

  function subscribe<R>(
    selector: Selector<T["state"], R, T["computed"]>,
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

    const subscriber: Subscriber<T["state"], T["computed"], R> = {
      selector,
      listener,
      lastValue,
      initialized,
    };

    subscribers.add(subscriber as Subscriber<T["state"], T["computed"], unknown>);
    return () => {
      subscribers.delete(subscriber as Subscriber<T["state"], T["computed"], unknown>);
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

  function getSnapshot(): Snapshot<T["state"], T["computed"]> {
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
  ): Snapshot<T["state"], T["computed"]> {
    assertCanonicalSnapshotShape(snapshot);
    assertCanonicalSnapshotValueDomain(snapshot);
    visibleCanonicalSnapshot = structuredClone(snapshot);
    host.reset(structuredClone(visibleCanonicalSnapshot));
    visibleCanonicalReadSnapshot = cloneAndDeepFreeze(
      visibleCanonicalSnapshot as CanonicalSnapshot<T["state"]>,
    );

    const nextProjectedSnapshot = projectSnapshotFromCanonical(visibleCanonicalSnapshot);
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
    const result = dispatchQueue.catch(() => {}).then(task);

    dispatchQueue = result.then(
      () => undefined,
      () => undefined,
    );
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

  function notifySubscribers(snapshot: Snapshot<T["state"], T["computed"]>): void {
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
