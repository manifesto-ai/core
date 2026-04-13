import type { Snapshot as CoreSnapshot } from "@manifesto-ai/core";

import type {
  CanonicalSnapshot,
  ManifestoDomainShape,
  ManifestoEventMap,
  Snapshot,
  TypedIntent,
} from "../types.js";
import {
  emitDispatchCompletedEvent,
  emitDispatchFailedEvent,
} from "./events.js";
import type {
  PublishedRuntimeSnapshot,
  RuntimePublicationHelpers,
} from "./facets.js";

type RuntimePublicationOptions<T extends ManifestoDomainShape> = {
  readonly setVisibleSnapshot: (
    snapshot: CoreSnapshot,
    options?: { readonly notify?: boolean },
  ) => Snapshot<T["state"]>;
  readonly restoreVisibleSnapshot: () => void;
  readonly getCanonicalSnapshot: () => CanonicalSnapshot<T["state"]>;
  readonly emitEvent: <K extends keyof ManifestoEventMap<T>>(
    event: K,
    payload: ManifestoEventMap<T>[K],
  ) => void;
};

export function createRuntimePublication<T extends ManifestoDomainShape>({
  setVisibleSnapshot,
  restoreVisibleSnapshot,
  getCanonicalSnapshot,
  emitEvent,
}: RuntimePublicationOptions<T>): RuntimePublicationHelpers<T> {
  function replaceVisibleSnapshot(
    snapshot: CoreSnapshot,
    options?: { readonly notify?: boolean },
  ): Snapshot<T["state"]> {
    return setVisibleSnapshot(snapshot, options);
  }

  function publishCompletedHostResult(
    intent: TypedIntent<T>,
    snapshot: CoreSnapshot,
  ): PublishedRuntimeSnapshot<T> {
    const publishedSnapshot = replaceVisibleSnapshot(snapshot);
    emitDispatchCompletedEvent(emitEvent, intent, publishedSnapshot);

    return Object.freeze({
      publishedSnapshot,
      publishedCanonicalSnapshot: getCanonicalSnapshot(),
    }) as PublishedRuntimeSnapshot<T>;
  }

  function publishFailedHostResult(
    intent: TypedIntent<T>,
    error: Error,
    snapshot: CoreSnapshot,
  ): PublishedRuntimeSnapshot<T> {
    const publishedSnapshot = replaceVisibleSnapshot(snapshot);
    emitDispatchFailedEvent(emitEvent, intent, error, publishedSnapshot);

    return Object.freeze({
      publishedSnapshot,
      publishedCanonicalSnapshot: getCanonicalSnapshot(),
    }) as PublishedRuntimeSnapshot<T>;
  }

  return Object.freeze({
    replaceVisibleSnapshot,
    restoreVisibleSnapshot,
    publishCompletedHostResult,
    publishFailedHostResult,
  }) as RuntimePublicationHelpers<T>;
}
