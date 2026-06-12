import type { Snapshot as CoreSnapshot } from "@manifesto-ai/core";

import type {
  CanonicalSnapshot,
  ManifestoDomainShape,
  ProjectedSnapshot,
} from "../types.js";
import type {
  PublishedRuntimeSnapshot,
  RuntimePublicationHelpers,
} from "./facets.js";

type RuntimePublicationOptions<T extends ManifestoDomainShape> = {
  readonly setVisibleSnapshot: (
    snapshot: CoreSnapshot,
    options?: { readonly notify?: boolean },
  ) => ProjectedSnapshot<T>;
  readonly restoreVisibleSnapshot: () => void;
  readonly getCanonicalSnapshot: () => CanonicalSnapshot<T["state"]>;
};

export function createRuntimePublication<T extends ManifestoDomainShape>({
  setVisibleSnapshot,
  restoreVisibleSnapshot,
  getCanonicalSnapshot,
}: RuntimePublicationOptions<T>): RuntimePublicationHelpers<T> {
  function replaceVisibleSnapshot(
    snapshot: CoreSnapshot,
    options?: { readonly notify?: boolean },
  ): ProjectedSnapshot<T> {
    return setVisibleSnapshot(snapshot, options);
  }

  function publishCompletedHostResult(
    snapshot: CoreSnapshot,
  ): PublishedRuntimeSnapshot<T> {
    const publishedSnapshot = replaceVisibleSnapshot(snapshot);

    return Object.freeze({
      publishedSnapshot,
      publishedCanonicalSnapshot: getCanonicalSnapshot(),
    }) as PublishedRuntimeSnapshot<T>;
  }

  function publishFailedHostResult(
    snapshot: CoreSnapshot,
  ): PublishedRuntimeSnapshot<T> {
    const publishedSnapshot = replaceVisibleSnapshot(snapshot);

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
